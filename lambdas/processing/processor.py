import json
import os
import boto3
from datetime import datetime

bedrock = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')

INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']
table = dynamodb.Table(INSIGHTS_TABLE)

PROMPT_TEMPLATE = """Analyze this pharmaceutical news and provide competitive intelligence insights.

Molecule: {molecule}
Content: {content}

Provide a structured analysis with:
1. Headline (one sentence)
2. Sentiment (Positive/Neutral/Negative)
3. Key Risks (2 points max)
4. Key Opportunities (2 points max)
5. Strategic Summary (5 bullets)

Format as JSON."""

def lambda_handler(event, context):
    for record in event['Records']:
        try:
            message = json.loads(record['body'])
            molecule = message['molecule']
            content = message['content']
            source = message.get('source', 'Unknown')
            
            # Generate insights using Amazon Nova Pro
            prompt = PROMPT_TEMPLATE.format(molecule=molecule, content=content)
            
            # Use Amazon Nova Pro for cost-effective batch processing
            # Nova Pro: $0.80/$3.20 per 1M tokens with 300K context window
            response = bedrock.invoke_model(
                modelId='amazon.nova-pro-v1:0',
                body=json.dumps({
                    'messages': [{'role': 'user', 'content': [{'text': prompt}]}],
                    'inferenceConfig': {
                        'maxTokens': 1000,
                        'temperature': 0.7
                    }
                })
            )
            
            result = json.loads(response['body'].read())
            insights = result['content'][0]['text']
            
            # Store in DynamoDB
            timestamp = datetime.utcnow().isoformat()
            table.put_item(Item={
                'molecule': molecule,
                'timestamp': timestamp,
                'insights': insights,
                'source': source,
                'raw_content': content[:1000]  # Store first 1000 chars
            })
            
            print(f"Processed insights for {molecule}")
            
        except Exception as e:
            print(f"Error processing record: {str(e)}")
            raise
    
    return {'statusCode': 200, 'body': json.dumps('Processing complete')}
