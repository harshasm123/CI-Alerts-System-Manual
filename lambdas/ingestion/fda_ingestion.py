import json
import os
import boto3
import requests
import feedparser
from datetime import datetime, timedelta
import uuid
from bs4 import BeautifulSoup

sqs = boto3.client('sqs')
s3 = boto3.client('s3')

QUEUE_URL = os.environ['RAW_EVENT_QUEUE_URL']
DATA_BUCKET = os.environ['DATA_BUCKET']

# FDA RSS feeds and API endpoints
FDA_SOURCES = [
    {
        'name': 'FDA Drug Approvals',
        'url': 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml',
        'type': 'rss'
    },
    {
        'name': 'FDA Safety Alerts',
        'url': 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/fda-drug-safety-communications/rss.xml',
        'type': 'rss'
    },
    {
        'name': 'FDA News Releases',
        'url': 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-announcements/rss.xml',
        'type': 'rss'
    }
]

# Common pharmaceutical molecules to filter for
MOLECULES = [
    'pembrolizumab', 'nivolumab', 'atezolizumab', 'durvalumab',
    'adalimumab', 'infliximab', 'rituximab', 'trastuzumab',
    'bevacizumab', 'cetuximab', 'panitumumab', 'ramucirumab',
    'lenalidomide', 'ibrutinib', 'venetoclax', 'osimertinib',
    'keytruda', 'opdivo', 'tecentriq', 'imfinzi', 'humira',
    'remicade', 'rituxan', 'herceptin', 'avastin', 'erbitux'
]

def handler(event, context):
    """
    Fetch recent FDA announcements and filter for pharmaceutical molecules
    """
    try:
        results = []
        
        # Calculate date range (last 7 days)
        cutoff_date = datetime.now() - timedelta(days=7)
        
        for source in FDA_SOURCES:
            try:
                if source['type'] == 'rss':
                    items = fetch_rss_feed(source['url'], source['name'])
                    
                    for item in items:
                        # Check if item is recent
                        if item.get('published_date'):
                            try:
                                pub_date = datetime.fromisoformat(item['published_date'].replace('Z', '+00:00'))
                                if pub_date < cutoff_date:
                                    continue
                            except:
                                pass  # If date parsing fails, include the item
                        
                        # Check if item mentions any molecules
                        relevant_molecules = find_relevant_molecules(item)
                        
                        if relevant_molecules:
                            for molecule in relevant_molecules:
                                # Create event payload
                                event_data = {
                                    'source': 'FDA',
                                    'source_detail': source['name'],
                                    'molecule': molecule,
                                    'title': item.get('title', ''),
                                    'description': item.get('description', ''),
                                    'content': item.get('content', ''),
                                    'url': item.get('url', ''),
                                    'published_date': item.get('published_date', ''),
                                    'timestamp': datetime.now().isoformat(),
                                    'event_id': str(uuid.uuid4())
                                }
                                
                                # Send to SQS
                                sqs.send_message(
                                    QueueUrl=QUEUE_URL,
                                    MessageBody=json.dumps(event_data),
                                    MessageAttributes={
                                        'source': {'StringValue': 'FDA', 'DataType': 'String'},
                                        'molecule': {'StringValue': molecule, 'DataType': 'String'}
                                    }
                                )
                                
                                results.append(event_data)
                    
            except Exception as e:
                print(f"Error processing FDA source {source['name']}: {str(e)}")
                continue
        
        # Store raw data in S3
        s3_key = f"raw/fda/{datetime.now().strftime('%Y/%m/%d')}/{datetime.now().strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=DATA_BUCKET,
            Key=s3_key,
            Body=json.dumps(results, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully processed {len(results)} FDA items',
                'items_count': len(results),
                's3_location': f's3://{DATA_BUCKET}/{s3_key}'
            })
        }
        
    except Exception as e:
        print(f"Error in FDA ingestion: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def fetch_rss_feed(url, source_name):
    """
    Fetch and parse RSS feed
    """
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        items = []
        
        for entry in feed.entries:
            # Extract content
            content = ''
            if hasattr(entry, 'content') and entry.content:
                content = entry.content[0].value if isinstance(entry.content, list) else entry.content
            elif hasattr(entry, 'summary'):
                content = entry.summary
            
            # Clean HTML content
            if content:
                soup = BeautifulSoup(content, 'html.parser')
                content = soup.get_text(strip=True)
            
            item = {
                'title': getattr(entry, 'title', ''),
                'description': getattr(entry, 'summary', ''),
                'content': content,
                'url': getattr(entry, 'link', ''),
                'published_date': getattr(entry, 'published', '')
            }
            
            items.append(item)
        
        return items
        
    except Exception as e:
        print(f"Error fetching RSS feed {url}: {str(e)}")
        return []

def find_relevant_molecules(item):
    """
    Find pharmaceutical molecules mentioned in the item
    """
    relevant_molecules = []
    
    # Combine all text content
    text_content = ' '.join([
        item.get('title', ''),
        item.get('description', ''),
        item.get('content', '')
    ]).lower()
    
    # Check for molecule mentions
    for molecule in MOLECULES:
        if molecule.lower() in text_content:
            relevant_molecules.append(molecule)
    
    return list(set(relevant_molecules))  # Remove duplicates