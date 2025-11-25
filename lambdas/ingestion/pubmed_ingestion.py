import json
import os
import boto3
import requests
from datetime import datetime, timedelta

sqs = boto3.client('sqs')
s3 = boto3.client('s3')

QUEUE_URL = os.environ['QUEUE_URL']
DATA_BUCKET = os.environ['DATA_BUCKET']

PUBMED_API = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'

MOLECULES = [
    'Humira', 'Keytruda', 'Revlimid', 'Eliquis', 'Opdivo',
    'Eylea', 'Dupixent', 'Xtandi', 'Ibrance', 'Imbruvica'
]

def lambda_handler(event, context):
    results = []
    
    for molecule in MOLECULES:
        try:
            # Search PubMed for recent articles
            search_url = f"{PUBMED_API}esearch.fcgi"
            params = {
                'db': 'pubmed',
                'term': molecule,
                'retmax': 5,
                'retmode': 'json',
                'sort': 'date'
            }
            
            response = requests.get(search_url, params=params, timeout=10)
            data = response.json()
            
            if 'esearchresult' in data and 'idlist' in data['esearchresult']:
                pmids = data['esearchresult']['idlist']
                
                # Fetch article details
                if pmids:
                    fetch_url = f"{PUBMED_API}efetch.fcgi"
                    fetch_params = {
                        'db': 'pubmed',
                        'id': ','.join(pmids),
                        'retmode': 'xml'
                    }
                    
                    articles_response = requests.get(fetch_url, params=fetch_params, timeout=10)
                    content = articles_response.text
                    
                    # Store raw data in S3
                    timestamp = datetime.utcnow().isoformat()
                    s3_key = f"pubmed/{molecule}/{timestamp}.xml"
                    s3.put_object(
                        Bucket=DATA_BUCKET,
                        Key=s3_key,
                        Body=content
                    )
                    
                    # Send to SQS for processing
                    message = {
                        'molecule': molecule,
                        'content': content[:5000],  # Limit size
                        'source': 'PubMed',
                        'timestamp': timestamp,
                        's3_key': s3_key
                    }
                    
                    sqs.send_message(
                        QueueUrl=QUEUE_URL,
                        MessageBody=json.dumps(message)
                    )
                    
                    results.append(f"Processed {len(pmids)} articles for {molecule}")
                    
        except Exception as e:
            print(f"Error processing {molecule}: {str(e)}")
            continue
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Ingestion complete',
            'results': results
        })
    }
