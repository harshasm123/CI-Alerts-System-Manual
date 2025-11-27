import json
import os
import boto3
import uuid

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

AGENT_ID = os.environ['AGENT_ID']
AGENT_ALIAS_ID = os.environ['AGENT_ALIAS_ID']

def lambda_handler(event, context):
    body = json.loads(event.get('body', '{}'))
    query = body.get('query', '')
    session_id = body.get('sessionId', str(uuid.uuid4()))
    
    if not query:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Query is required'})
        }
    
    try:
        response = bedrock_agent_runtime.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=AGENT_ALIAS_ID,
            sessionId=session_id,
            inputText=query
        )
        
        completion = ''
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                completion += chunk.get('bytes', b'').decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'response': completion,
                'sessionId': session_id
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
