import json
import os
import boto3
from boto3.dynamodb.conditions import Key

# Initialize clients
dynamodb = boto3.resource('dynamodb')
bedrock_agent = boto3.client('bedrock-agent-runtime')

INSIGHTS_TABLE = os.environ.get('INSIGHTS_TABLE')
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID')

def lambda_handler(event, context):
    """
    Action handler for Bedrock Agent
    Provides pharmaceutical competitive intelligence actions
    """
    
    try:
        # Parse the agent request
        action_group = event.get('actionGroup', '')
        api_path = event.get('apiPath', '')
        parameters = event.get('parameters', [])
        
        # Convert parameters to dict
        params = {}
        for param in parameters:
            params[param['name']] = param['value']
        
        # Route to appropriate action
        if api_path == '/search-insights':
            return search_insights(params)
        elif api_path == '/analyze-competition':
            return analyze_competition(params)
        else:
            return {
                'messageVersion': '1.0',
                'response': {
                    'actionGroup': action_group,
                    'apiPath': api_path,
                    'httpMethod': event.get('httpMethod', 'POST'),
                    'httpStatusCode': 404,
                    'responseBody': {
                        'application/json': {
                            'body': json.dumps({'error': 'Action not found'})
                        }
                    }
                }
            }
            
    except Exception as e:
        return {
            'messageVersion': '1.0',
            'response': {
                'actionGroup': action_group,
                'apiPath': api_path,
                'httpMethod': event.get('httpMethod', 'POST'),
                'httpStatusCode': 500,
                'responseBody': {
                    'application/json': {
                        'body': json.dumps({'error': str(e)})
                    }
                }
            }
        }

def search_insights(params):
    """Search for competitive insights by molecule"""
    
    molecule = params.get('molecule', '')
    if not molecule:
        return error_response('Molecule parameter required')
    
    try:
        # Query DynamoDB for insights
        table = dynamodb.Table(INSIGHTS_TABLE)
        
        # Try GSI1 first, fallback to scan
        try:
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression=Key('GSI1PK').eq(molecule),
                ScanIndexForward=False,
                Limit=10
            )
        except:
            response = table.scan(
                FilterExpression=Key('molecule').eq(molecule),
                Limit=10
            )
        
        insights = []
        for item in response.get('Items', []):
            insights.append({
                'molecule': item.get('molecule', ''),
                'timestamp': item.get('timestamp', ''),
                'summary': item.get('insights', item.get('summary', ''))[:200],
                'source': item.get('source', 'Unknown'),
                'impact_score': item.get('impact_score', 0)
            })
        
        return success_response({
            'insights': insights,
            'count': len(insights),
            'molecule': molecule
        })
        
    except Exception as e:
        return error_response(f'Failed to search insights: {str(e)}')

def analyze_competition(params):
    """Analyze competitive landscape for a molecule"""
    
    molecule = params.get('molecule', '')
    if not molecule:
        return error_response('Molecule parameter required')
    
    try:
        # Get recent insights for the molecule
        table = dynamodb.Table(INSIGHTS_TABLE)
        
        try:
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression=Key('GSI1PK').eq(molecule),
                ScanIndexForward=False,
                Limit=20
            )
        except:
            response = table.scan(
                FilterExpression=Key('molecule').eq(molecule),
                Limit=20
            )
        
        insights = response.get('Items', [])
        
        # Analyze competitive themes
        competitors = set()
        threats = []
        opportunities = []
        
        for insight in insights:
            content = insight.get('insights', insight.get('summary', ''))
            
            # Simple keyword analysis for competitors
            if any(word in content.lower() for word in ['competitor', 'rival', 'competing']):
                # Extract potential competitor names (simplified)
                words = content.split()
                for i, word in enumerate(words):
                    if word.lower() in ['competitor', 'rival'] and i > 0:
                        competitors.add(words[i-1])
            
            # Identify threats and opportunities
            if any(word in content.lower() for word in ['threat', 'risk', 'challenge']):
                threats.append(content[:100] + '...')
            
            if any(word in content.lower() for word in ['opportunity', 'advantage', 'potential']):
                opportunities.append(content[:100] + '...')
        
        analysis = f"Competitive analysis for {molecule} based on {len(insights)} recent insights. "
        analysis += f"Identified {len(competitors)} potential competitors and {len(threats)} threats."
        
        return success_response({
            'analysis': analysis,
            'competitors': list(competitors)[:5],
            'threats': threats[:3],
            'opportunities': opportunities[:3],
            'insight_count': len(insights)
        })
        
    except Exception as e:
        return error_response(f'Failed to analyze competition: {str(e)}')

def success_response(data):
    """Return successful response"""
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': 'pharmaceutical-actions',
            'apiPath': '/search-insights',
            'httpMethod': 'POST',
            'httpStatusCode': 200,
            'responseBody': {
                'application/json': {
                    'body': json.dumps(data)
                }
            }
        }
    }

def error_response(message):
    """Return error response"""
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': 'pharmaceutical-actions',
            'apiPath': '/search-insights',
            'httpMethod': 'POST',
            'httpStatusCode': 400,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'error': message})
                }
            }
        }
    }