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

QUEUE_URL = os.environ['QUEUE_URL']
DATA_BUCKET = os.environ['DATA_BUCKET']

# Common pharmaceutical molecules to search for
MOLECULES = [
    'pembrolizumab', 'nivolumab', 'atezolizumab', 'durvalumab',
    'adalimumab', 'infliximab', 'rituximab', 'trastuzumab',
    'bevacizumab', 'cetuximab', 'panitumumab', 'ramucirumab',
    'lenalidomide', 'ibrutinib', 'venetoclax', 'osimertinib'
]

def handler(event, context):
    """
    Fetch recent patent publications from WIPO for pharmaceutical molecules
    """
    try:
        results = []
        
        # Calculate date range (last 30 days for patents)
        cutoff_date = datetime.now() - timedelta(days=30)
        
        for molecule in MOLECULES:
            try:
                # Search WIPO PatentScope for the molecule
                patents = search_wipo_patents(molecule)
                
                for patent in patents:
                    # Check if patent is recent
                    if patent.get('published_date'):
                        try:
                            pub_date = datetime.fromisoformat(patent['published_date'].replace('Z', '+00:00'))
                            if pub_date < cutoff_date:
                                continue
                        except:
                            pass  # If date parsing fails, include the patent
                    
                    # Create event payload
                    event_data = {
                        'source': 'WIPO',
                        'molecule': molecule,
                        'patent_number': patent.get('patent_number', ''),
                        'title': patent.get('title', ''),
                        'abstract': patent.get('abstract', ''),
                        'inventors': patent.get('inventors', []),
                        'applicants': patent.get('applicants', []),
                        'published_date': patent.get('published_date', ''),
                        'application_date': patent.get('application_date', ''),
                        'ipc_classes': patent.get('ipc_classes', []),
                        'url': patent.get('url', ''),
                        'timestamp': datetime.now().isoformat(),
                        'event_id': str(uuid.uuid4())
                    }
                    
                    # Send to SQS
                    sqs.send_message(
                        QueueUrl=QUEUE_URL,
                        MessageBody=json.dumps(event_data),
                        MessageAttributes={
                            'source': {'StringValue': 'WIPO', 'DataType': 'String'},
                            'molecule': {'StringValue': molecule, 'DataType': 'String'}
                        }
                    )
                    
                    results.append(event_data)
                    
            except Exception as e:
                print(f"Error processing molecule {molecule}: {str(e)}")
                continue
        
        # Store raw data in S3
        s3_key = f"raw/wipo/{datetime.now().strftime('%Y/%m/%d')}/{datetime.now().strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=DATA_BUCKET,
            Key=s3_key,
            Body=json.dumps(results, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully processed {len(results)} patents',
                'patents_count': len(results),
                's3_location': f's3://{DATA_BUCKET}/{s3_key}'
            })
        }
        
    except Exception as e:
        print(f"Error in WIPO ingestion: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def search_wipo_patents(molecule):
    """
    Search WIPO PatentScope for patents mentioning a specific molecule
    Note: This is a simplified implementation. In production, you would use the official WIPO API
    """
    try:
        # WIPO PatentScope RSS feed (simplified approach)
        rss_url = f"https://patentscope.wipo.int/search/en/rss.jsp?query={molecule}&maxRec=20"
        
        response = requests.get(rss_url, timeout=30)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        patents = []
        
        for entry in feed.entries:
            # Extract patent information from RSS entry
            title = getattr(entry, 'title', '')
            description = getattr(entry, 'summary', '')
            url = getattr(entry, 'link', '')
            published_date = getattr(entry, 'published', '')
            
            # Extract patent number from title or URL
            patent_number = extract_patent_number(title, url)
            
            # Clean HTML content
            if description:
                soup = BeautifulSoup(description, 'html.parser')
                description = soup.get_text(strip=True)
            
            patent = {
                'patent_number': patent_number,
                'title': title,
                'abstract': description,
                'inventors': [],  # Would need detailed API call to get this
                'applicants': [],  # Would need detailed API call to get this
                'published_date': published_date,
                'application_date': '',  # Would need detailed API call to get this
                'ipc_classes': [],  # Would need detailed API call to get this
                'url': url
            }
            
            patents.append(patent)
        
        return patents
        
    except Exception as e:
        print(f"Error searching WIPO patents for {molecule}: {str(e)}")
        return []

def extract_patent_number(title, url):
    """
    Extract patent number from title or URL
    """
    import re
    
    # Try to extract from URL first
    url_match = re.search(r'WO(\d{4}\d+)', url)
    if url_match:
        return f"WO{url_match.group(1)}"
    
    # Try to extract from title
    title_match = re.search(r'WO(\d{4}\d+)', title)
    if title_match:
        return f"WO{title_match.group(1)}"
    
    # Try other patent number formats
    other_match = re.search(r'([A-Z]{2}\d+[A-Z]?\d*)', title + ' ' + url)
    if other_match:
        return other_match.group(1)
    
    return ''