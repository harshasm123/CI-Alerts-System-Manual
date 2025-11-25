import json
import boto3
from insights_prompt_template import format_insights_prompt

bedrock_client = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
insights_table = dynamodb.Table('InsightsTable')

def lambda_handler(event, context):
    for record in event['Records']:
        message = json.loads(record['body'])
        molecule_name = message['molecule']
        article_content = message['content']
        
        # Generate insights using Bedrock Claude
        prompt = format_insights_prompt(molecule_name, article_content)
        
        response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 1000,
                'messages': [{'role': 'user', 'content': prompt}]
            })
        )
        
        result = json.loads(response['body'].read())
        insights = result['content'][0]['text']
        
        # Store in DynamoDB
        insights_table.put_item(Item={
            'molecule': molecule_name,
            'timestamp': message['timestamp'],
            'insights': insights,
            'source': message['source']
        })
    
    return {'statusCode': 200}