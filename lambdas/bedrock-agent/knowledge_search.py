import json
import os
import boto3
from typing import Dict, List, Any

bedrock_agent = boto3.client('bedrock-agent-runtime')

KNOWLEDGE_BASE_ID = os.environ['KNOWLEDGE_BASE_ID']

def search_knowledge_base(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Search the knowledge base using vector similarity"""
    try:
        response = bedrock_agent.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={'text': query},
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': limit,
                    'overrideSearchType': 'HYBRID'
                }
            }
        )
        
        results = []
        for item in response.get('retrievalResults', []):
            results.append({
                'content': item['content']['text'],
                'score': item['score'],
                'source': item['location']['s3Location']['uri'] if 'location' in item else 'Unknown',
                'metadata': item.get('metadata', {})
            })
        
        return results
    
    except Exception as e:
        print(f"Error searching knowledge base: {str(e)}")
        return []

def lambda_handler(event, context):
    """Handle knowledge base search requests"""
    try:
        # Parse the action request
        action = event.get('actionGroup', '')
        api_path = event.get('apiPath', '')
        
        if api_path == '/search-knowledge':
            # Extract query parameters
            request_body = json.loads(event.get('requestBody', {}).get('content', {}).get('application/json', '{}'))
            query = request_body.get('query', '')
            limit = request_body.get('limit', 5)
            
            if not query:
                return {
                    'actionGroupInvocationOutput': {
                        'text': json.dumps({
                            'error': 'Query parameter is required'
                        })
                    }
                }
            
            # Search knowledge base
            results = search_knowledge_base(query, limit)
            
            # Format response
            response_text = {
                'query': query,
                'results_count': len(results),
                'results': results
            }
            
            return {
                'actionGroupInvocationOutput': {
                    'text': json.dumps(response_text)
                }
            }
        
        else:
            return {
                'actionGroupInvocationOutput': {
                    'text': json.dumps({
                        'error': f'Unknown API path: {api_path}'
                    })
                }
            }
    
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return {
            'actionGroupInvocationOutput': {
                'text': json.dumps({
                    'error': f'Internal error: {str(e)}'
                })
            }
        }