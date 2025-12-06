import json
import os
import boto3
from datetime import datetime

s3 = boto3.client('s3')
bedrock_agent = boto3.client('bedrock-agent')

KNOWLEDGE_BASE_ID = os.environ['KNOWLEDGE_BASE_ID']
DATA_SOURCE_ID = os.environ['DATA_SOURCE_ID']

def lambda_handler(event, context):
    """Process documents and sync with knowledge base"""
    
    for record in event['Records']:
        try:
            # Parse S3 event
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            # Only process documents in the documents/ prefix
            if not key.startswith('documents/'):
                continue
            
            print(f"Processing document: s3://{bucket}/{key}")
            
            # Get document content
            response = s3.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read().decode('utf-8')
            
            # Extract metadata from filename/path
            metadata = extract_metadata(key, content)
            
            # Create structured document for knowledge base
            structured_doc = {
                'title': metadata.get('title', key.split('/')[-1]),
                'content': content,
                'source': f's3://{bucket}/{key}',
                'processed_date': datetime.utcnow().isoformat(),
                'metadata': metadata
            }
            
            # Save structured document back to S3
            structured_key = f"documents/processed/{key.split('/')[-1]}.json"
            s3.put_object(
                Bucket=bucket,
                Key=structured_key,
                Body=json.dumps(structured_doc),
                ContentType='application/json'
            )
            
            print(f"Structured document saved: s3://{bucket}/{structured_key}")
            
        except Exception as e:
            print(f"Error processing document {key}: {str(e)}")
            continue
    
    # Trigger knowledge base sync
    try:
        bedrock_agent.start_ingestion_job(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            dataSourceId=DATA_SOURCE_ID
        )
        print("Knowledge base ingestion job started")
    except Exception as e:
        print(f"Error starting ingestion job: {str(e)}")
    
    return {'statusCode': 200, 'body': json.dumps('Processing complete')}

def extract_metadata(key, content):
    """Extract metadata from document"""
    metadata = {}
    
    # Extract from path
    path_parts = key.split('/')
    if len(path_parts) > 2:
        metadata['category'] = path_parts[1]
    
    # Extract from filename
    filename = path_parts[-1]
    if 'fda' in filename.lower():
        metadata['source'] = 'FDA'
    elif 'ema' in filename.lower():
        metadata['source'] = 'EMA'
    elif 'pubmed' in filename.lower():
        metadata['source'] = 'PubMed'
    elif 'clinical' in filename.lower():
        metadata['source'] = 'ClinicalTrials'
    
    # Extract molecules from content (simple keyword matching)
    molecules = []
    common_molecules = ['keytruda', 'opdivo', 'tecentriq', 'bavencio', 'imfinzi']
    for molecule in common_molecules:
        if molecule.lower() in content.lower():
            molecules.append(molecule.title())
    
    if molecules:
        metadata['molecules'] = molecules
    
    return metadata