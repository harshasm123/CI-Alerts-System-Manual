import json
import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
insights_table = dynamodb.Table(os.environ['INSIGHTS_TABLE'])

def lambda_handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    api_path = event.get('apiPath')
    request_body = event.get('requestBody', {})
    
    # Parse properties
    content = request_body.get('content', {})
    properties = {}
    for item in content.values():
        if isinstance(item, list):
            for prop in item:
                properties.update(prop.get('properties', {}))
    
    # Route to action
    if api_path == '/query-insights':
        result = query_insights(properties)
    elif api_path == '/analyze-trends':
        result = analyze_trends(properties)
    elif api_path == '/compare-molecules':
        result = compare_molecules(properties)
    else:
        result = {'error': f'Unknown action: {api_path}'}
    
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': event.get('actionGroup'),
            'apiPath': api_path,
            'httpMethod': event.get('httpMethod'),
            'httpStatusCode': 200,
            'responseBody': {
                'application/json': {
                    'body': json.dumps(result)
                }
            }
        }
    }

def query_insights(properties):
    molecule = properties.get('molecule', {}).get('value', '')
    limit = int(properties.get('limit', {}).get('value', 10))
    
    response = insights_table.query(
        KeyConditionExpression=Key('molecule').eq(molecule),
        ScanIndexForward=False,
        Limit=limit
    )
    
    items = response.get('Items', [])
    return {
        'molecule': molecule,
        'insights': [{
            'timestamp': item.get('timestamp'),
            'summary': item.get('insights', '')[:200],
            'sentiment': item.get('sentiment', 'Neutral')
        } for item in items],
        'count': len(items)
    }

def analyze_trends(properties):
    molecule = properties.get('molecule', {}).get('value', '')
    days = int(properties.get('days', {}).get('value', 30))
    
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    response = insights_table.query(
        KeyConditionExpression=Key('molecule').eq(molecule) & Key('timestamp').gt(start_date)
    )
    
    items = response.get('Items', [])
    sentiments = [item.get('sentiment', 'Neutral') for item in items]
    
    return {
        'molecule': molecule,
        'period_days': days,
        'total_insights': len(items),
        'sentiment_distribution': {
            'positive': sentiments.count('Positive'),
            'negative': sentiments.count('Negative'),
            'neutral': sentiments.count('Neutral')
        }
    }

def compare_molecules(properties):
    molecule1 = properties.get('molecule1', {}).get('value', '')
    molecule2 = properties.get('molecule2', {}).get('value', '')
    
    response1 = insights_table.query(
        KeyConditionExpression=Key('molecule').eq(molecule1),
        Limit=5
    )
    response2 = insights_table.query(
        KeyConditionExpression=Key('molecule').eq(molecule2),
        Limit=5
    )
    
    return {
        'molecule1': {'name': molecule1, 'count': len(response1.get('Items', []))},
        'molecule2': {'name': molecule2, 'count': len(response2.get('Items', []))}
    }
