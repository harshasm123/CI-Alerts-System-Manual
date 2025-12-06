import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']
table = dynamodb.Table(INSIGHTS_TABLE)

def lambda_handler(event, context):
    params = event.get('queryStringParameters', {}) or {}
    molecule = params.get('molecule')
    limit = int(params.get('limit', 10))
    
    try:
        if molecule:
            # Get insights for specific molecule using GSI1
            try:
                response = table.query(
                    IndexName='GSI1',
                    KeyConditionExpression=Key('GSI1PK').eq(molecule),
                    ScanIndexForward=False,  # Sort by timestamp descending
                    Limit=limit
                )
            except Exception as e:
                print(f"GSI1 query failed, using scan: {str(e)}")
                # Fallback to scan with filter
                response = table.scan(
                    FilterExpression=Key('molecule').eq(molecule),
                    Limit=limit
                )
        else:
            # Get recent insights across all molecules
            response = table.scan(
                Limit=limit,
                # Sort by timestamp if available
                ScanIndexForward=False
            )
        
        items = response.get('Items', [])
        
        # Format items for frontend
        formatted_items = []
        for item in items:
            # Get the best available content
            summary = item.get('insights', item.get('summary', item.get('raw_content', 'No summary available')))
            if isinstance(summary, str) and len(summary) > 500:
                summary = summary[:500] + '...'
            
            formatted_items.append({
                'id': item.get('insight_id', item.get('id', '')),
                'molecule': item.get('molecule', ''),
                'timestamp': item.get('timestamp', ''),
                'summary': summary,
                'source': item.get('source', 'Unknown'),
                'impact_score': item.get('impact_score', 0),
                'url': item.get('url', '')
            })
        
        # Sort by timestamp descending
        formatted_items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'insights': formatted_items,
                'count': len(formatted_items)
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
