import json
import os
import boto3
import requests
from datetime import datetime, timedelta

sqs = boto3.client('sqs')
s3 = boto3.client('s3')

QUEUE_URL = os.environ['QUEUE_URL']
DATA_BUCKET = os.environ['DATA_BUCKET']

DEFAULT_MOLECULES = [
    'Humira', 'Keytruda', 'Revlimid', 'Eliquis', 'Opdivo',
    'Eylea', 'Dupixent', 'Xtandi', 'Ibrance', 'Imbruvica'
]

def lambda_handler(event, context):
    """Fetch FDA drug data from openFDA API"""
    
    molecules = event.get('molecules', DEFAULT_MOLECULES)
    if isinstance(molecules, str):
        molecules = [molecules]
    
    results = []
    
    for molecule in molecules:
        try:
            # Fetch drug labels and adverse events
            labels = fetch_drug_labels(molecule)
            events = fetch_adverse_events(molecule)
            
            count = len(labels) + len(events)
            if count > 0:
                for item in labels + events:
                    send_to_queue(item)
                results.append(f"Processed {count} FDA records for {molecule}")
            else:
                results.append(f"No FDA data found for {molecule}")
        except Exception as e:
            print(f"Error processing {molecule}: {str(e)}")
            results.append(f"Error for {molecule}: {str(e)}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'FDA ingestion complete',
            'results': results
        })
    }

def fetch_drug_labels(molecule):
    """Fetch drug labels from openFDA API"""
    
    base_url = "https://api.fda.gov/drug/label.json"
    params = {
        'search': f'openfda.brand_name:"{molecule}" OR openfda.generic_name:"{molecule}"',
        'limit': 5
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        labels = []
        for result in data.get('results', []):
            openfda = result.get('openfda', {})
            
            label = {
                'molecule': molecule,
                'source': 'FDA Drug Labels',
                'title': f"FDA Label: {openfda.get('brand_name', [molecule])[0] if openfda.get('brand_name') else molecule}",
                'content': '\n\n'.join([
                    result.get('purpose', [''])[0] if result.get('purpose') else '',
                    result.get('indications_and_usage', [''])[0] if result.get('indications_and_usage') else '',
                    result.get('warnings', [''])[0] if result.get('warnings') else ''
                ]),
                'url': 'https://www.fda.gov/drugs',
                'metadata': {
                    'brand_name': openfda.get('brand_name', []),
                    'generic_name': openfda.get('generic_name', []),
                    'manufacturer': openfda.get('manufacturer_name', []),
                    'product_type': openfda.get('product_type', [])
                },
                'timestamp': datetime.now().isoformat()
            }
            
            labels.append(label)
        
        return labels
        
    except Exception as e:
        print(f"Error fetching FDA labels for {molecule}: {str(e)}")
        return []

def fetch_adverse_events(molecule):
    """Fetch adverse events from openFDA API"""
    
    base_url = "https://api.fda.gov/drug/event.json"
    
    # Get events from last 90 days
    date_90_days_ago = (datetime.now() - timedelta(days=90)).strftime('%Y%m%d')
    
    params = {
        'search': f'patient.drug.openfda.brand_name:"{molecule}" AND receivedate:[{date_90_days_ago} TO 99991231]',
        'count': 'patient.reaction.reactionmeddrapt.exact',
        'limit': 10
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        events = []
        results = data.get('results', [])[:5]  # Top 5 reactions
        
        if results:
            reactions = [f"{r['term']}: {r['count']} reports" for r in results]
            
            event = {
                'molecule': molecule,
                'source': 'FDA Adverse Events',
                'title': f"Recent Adverse Events: {molecule}",
                'content': f"Top adverse reactions reported in last 90 days:\n\n" + '\n'.join(reactions),
                'url': 'https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program',
                'metadata': {
                    'reactions': results,
                    'period': '90 days'
                },
                'timestamp': datetime.now().isoformat()
            }
            
            events.append(event)
        
        return events
        
    except Exception as e:
        print(f"Error fetching FDA adverse events for {molecule}: {str(e)}")
        return []

def send_to_queue(item):
    """Send FDA data to SQS for processing"""
    
    message = {
        'molecule': item['molecule'],
        'source': item['source'],
        'title': item['title'],
        'content': item['content'][:2000],  # Limit content size
        'url': item['url'],
        'metadata': item['metadata'],
        'timestamp': item['timestamp']
    }
    
    try:
        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        print(f"Sent FDA data to queue: {item['title']}")
    except Exception as e:
        print(f"Error sending to queue: {str(e)}")
