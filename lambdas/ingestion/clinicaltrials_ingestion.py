import json
import os
import boto3
import requests
from datetime import datetime, timedelta

sqs = boto3.client('sqs')
s3 = boto3.client('s3')

QUEUE_URL = os.environ['QUEUE_URL']
DATA_BUCKET = os.environ['DATA_BUCKET']

# Default molecules to track
DEFAULT_MOLECULES = [
    'Humira', 'Keytruda', 'Revlimid', 'Eliquis', 'Opdivo',
    'Eylea', 'Dupixent', 'Xtandi', 'Ibrance', 'Imbruvica'
]

def lambda_handler(event, context):
    """Fetch clinical trials data from ClinicalTrials.gov API"""
    
    # Get molecules from event or use defaults
    molecules = event.get('molecules', DEFAULT_MOLECULES)
    if isinstance(molecules, str):
        molecules = [molecules]
    
    results = []
    
    for molecule in molecules:
        try:
            trials = fetch_clinical_trials(molecule)
            if trials:
                for trial in trials:
                    send_to_queue(trial)
                results.append(f"Processed {len(trials)} trials for {molecule}")
            else:
                results.append(f"No trials found for {molecule}")
        except Exception as e:
            print(f"Error processing {molecule}: {str(e)}")
            results.append(f"Error for {molecule}: {str(e)}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'ClinicalTrials ingestion complete',
            'results': results
        })
    }

def fetch_clinical_trials(molecule):
    """Fetch clinical trials from ClinicalTrials.gov API"""
    
    # ClinicalTrials.gov API v2
    base_url = "https://clinicaltrials.gov/api/v2/studies"
    
    # Search for trials updated in last 30 days
    params = {
        'query.term': molecule,
        'filter.advanced': 'AREA[LastUpdatePostDate]RANGE[MIN,MAX]',
        'pageSize': 10,
        'format': 'json'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        trials = []
        studies = data.get('studies', [])
        
        for study in studies:
            protocol = study.get('protocolSection', {})
            identification = protocol.get('identificationModule', {})
            status = protocol.get('statusModule', {})
            description = protocol.get('descriptionModule', {})
            conditions = protocol.get('conditionsModule', {})
            
            trial = {
                'molecule': molecule,
                'source': 'ClinicalTrials.gov',
                'nct_id': identification.get('nctId', ''),
                'title': identification.get('briefTitle', ''),
                'status': status.get('overallStatus', ''),
                'phase': status.get('phase', 'N/A'),
                'conditions': conditions.get('conditions', []),
                'summary': description.get('briefSummary', ''),
                'url': f"https://clinicaltrials.gov/study/{identification.get('nctId', '')}",
                'last_update': status.get('lastUpdatePostDate', ''),
                'timestamp': datetime.now().isoformat()
            }
            
            trials.append(trial)
        
        return trials
        
    except Exception as e:
        print(f"Error fetching trials for {molecule}: {str(e)}")
        return []

def send_to_queue(trial):
    """Send trial data to SQS for processing"""
    
    message = {
        'molecule': trial['molecule'],
        'source': trial['source'],
        'title': trial['title'],
        'content': f"{trial['title']}\n\nPhase: {trial['phase']}\nStatus: {trial['status']}\n\n{trial['summary']}",
        'url': trial['url'],
        'metadata': {
            'nct_id': trial['nct_id'],
            'phase': trial['phase'],
            'status': trial['status'],
            'conditions': trial['conditions'],
            'last_update': trial['last_update']
        },
        'timestamp': trial['timestamp']
    }
    
    try:
        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        print(f"Sent trial {trial['nct_id']} to queue")
    except Exception as e:
        print(f"Error sending to queue: {str(e)}")
