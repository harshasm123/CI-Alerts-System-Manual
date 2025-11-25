import json
import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key, Attr

# AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']
WATCHLIST_TABLE = os.environ['WATCHLIST_TABLE']

# DynamoDB tables
insights_table = dynamodb.Table(INSIGHTS_TABLE)
watchlist_table = dynamodb.Table(WATCHLIST_TABLE)

def handler(event, context):
    """
    Handle insights API requests
    """
    try:
        http_method = event['httpMethod']
        path_parameters = event.get('pathParameters') or {}
        query_parameters = event.get('queryStringParameters') or {}
        
        # Extract user ID from JWT token
        user_id = extract_user_id(event)
        if not user_id:
            return {
                'statusCode': 401,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        if http_method == 'GET':
            molecule = path_parameters.get('molecule')
            if molecule:
                return get_molecule_insights(user_id, molecule, query_parameters)
            else:
                return get_user_insights(user_id, query_parameters)
        else:
            return {
                'statusCode': 405,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Method not allowed'})
            }
            
    except Exception as e:
        print(f"Error in insights API: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
        }

def extract_user_id(event):
    """
    Extract user ID from Cognito JWT token
    """
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        return claims.get('sub')  # Cognito user ID
    except Exception as e:
        print(f"Error extracting user ID: {str(e)}")
        return None

def get_user_insights(user_id, query_parameters):
    """
    Get insights for all molecules in user's watchlist
    """
    try:
        # Get user's watchlist
        watchlist_response = watchlist_table.query(
            KeyConditionExpression=Key('user_id').eq(user_id)
        )
        
        molecules = [item['molecule'] for item in watchlist_response.get('Items', [])]
        
        if not molecules:
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({
                    'insights': [],
                    'total_count': 0,
                    'message': 'No molecules in watchlist'
                })
            }
        
        # Parse query parameters
        days = int(query_parameters.get('days', 7))
        limit = int(query_parameters.get('limit', 50))
        min_relevance = float(query_parameters.get('min_relevance', 0.0))
        source = query_parameters.get('source')
        impact_level = query_parameters.get('impact_level')
        
        # Calculate time range
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        start_timestamp = start_time.isoformat()
        
        # Get insights for all molecules
        all_insights = []
        
        for molecule in molecules:
            try:
                response = insights_table.query(
                    IndexName='molecule-timestamp-index',
                    KeyConditionExpression=Key('molecule').eq(molecule) & Key('timestamp').gte(start_timestamp),
                    ScanIndexForward=False,  # Most recent first
                    Limit=20  # Limit per molecule
                )
                
                molecule_insights = response.get('Items', [])
                all_insights.extend(molecule_insights)
                
            except Exception as e:
                print(f"Error getting insights for molecule {molecule}: {str(e)}")
                continue
        
        # Apply filters
        filtered_insights = []
        for insight in all_insights:
            # Relevance filter
            if insight.get('relevance_score', 0) < min_relevance:
                continue
            
            # Source filter
            if source and insight.get('source', '').lower() != source.lower():
                continue
            
            # Impact level filter
            if impact_level and insight.get('impact_level', '').upper() != impact_level.upper():
                continue
            
            filtered_insights.append(insight)
        
        # Sort by relevance score and timestamp
        filtered_insights.sort(
            key=lambda x: (x.get('relevance_score', 0), x.get('timestamp', '')), 
            reverse=True
        )
        
        # Apply limit
        limited_insights = filtered_insights[:limit]
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'insights': limited_insights,
                'total_count': len(limited_insights),
                'filtered_count': len(filtered_insights),
                'molecules': molecules,
                'filters': {
                    'days': days,
                    'min_relevance': min_relevance,
                    'source': source,
                    'impact_level': impact_level
                }
            })
        }
        
    except Exception as e:
        print(f"Error getting user insights: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to get insights'})
        }

def get_molecule_insights(user_id, molecule, query_parameters):
    """
    Get insights for a specific molecule
    """
    try:
        molecule = molecule.lower()
        
        # Verify molecule is in user's watchlist
        try:
            watchlist_item = watchlist_table.get_item(
                Key={'user_id': user_id, 'molecule': molecule}
            )
            if 'Item' not in watchlist_item:
                return {
                    'statusCode': 403,
                    'headers': get_cors_headers(),
                    'body': json.dumps({'error': 'Molecule not in your watchlist'})
                }
        except Exception:
            return {
                'statusCode': 403,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Molecule not in your watchlist'})
            }
        
        # Parse query parameters
        days = int(query_parameters.get('days', 30))
        limit = int(query_parameters.get('limit', 100))
        min_relevance = float(query_parameters.get('min_relevance', 0.0))
        source = query_parameters.get('source')
        impact_level = query_parameters.get('impact_level')
        
        # Calculate time range
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        start_timestamp = start_time.isoformat()
        
        # Get insights for the molecule
        response = insights_table.query(
            IndexName='molecule-timestamp-index',
            KeyConditionExpression=Key('molecule').eq(molecule) & Key('timestamp').gte(start_timestamp),
            ScanIndexForward=False,  # Most recent first
            Limit=limit * 2  # Get more to allow for filtering
        )
        
        insights = response.get('Items', [])
        
        # Apply filters
        filtered_insights = []
        for insight in insights:
            # Relevance filter
            if insight.get('relevance_score', 0) < min_relevance:
                continue
            
            # Source filter
            if source and insight.get('source', '').lower() != source.lower():
                continue
            
            # Impact level filter
            if impact_level and insight.get('impact_level', '').upper() != impact_level.upper():
                continue
            
            filtered_insights.append(insight)
        
        # Apply limit
        limited_insights = filtered_insights[:limit]
        
        # Get summary statistics
        stats = {
            'total_insights': len(limited_insights),
            'high_impact': len([i for i in limited_insights if i.get('impact_level') == 'HIGH']),
            'medium_impact': len([i for i in limited_insights if i.get('impact_level') == 'MEDIUM']),
            'low_impact': len([i for i in limited_insights if i.get('impact_level') == 'LOW']),
            'avg_relevance': sum([i.get('relevance_score', 0) for i in limited_insights]) / len(limited_insights) if limited_insights else 0,
            'sources': list(set([i.get('source', '') for i in limited_insights]))
        }
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'molecule': molecule,
                'insights': limited_insights,
                'stats': stats,
                'filters': {
                    'days': days,
                    'min_relevance': min_relevance,
                    'source': source,
                    'impact_level': impact_level
                }
            })
        }
        
    except Exception as e:
        print(f"Error getting molecule insights: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to get molecule insights'})
        }

def get_cors_headers():
    """
    Get CORS headers for API responses
    """
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Content-Type': 'application/json'
    }