import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

def lambda_handler(event, context):
    try:
        table = dynamodb.Table(os.environ['MOLECULES_TABLE'])
        queue_url = os.environ['QUEUE_URL']
        
        body = json.loads(event['body'])
        molecule = body['molecule'].strip()
        brand_name = body.get('brand_name', '').strip()
        
        # Add to tracking table
        table.put_item(Item={
            'molecule': molecule,
            'brand_name': brand_name,
            'added_date': datetime.utcnow().isoformat(),
            'status': 'active'
        })
        
        # Trigger immediate ingestion
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({
                'action': 'ingest_molecule',
                'molecule': molecule,
                'brand_name': brand_name
            })
        )
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': f'Added {molecule} for tracking'})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }