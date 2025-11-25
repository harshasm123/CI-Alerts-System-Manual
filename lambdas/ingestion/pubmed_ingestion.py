import json
import os
import boto3
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from urllib.parse import quote
import uuid

sqs = boto3.client('sqs')
s3 = boto3.client('s3')

QUEUE_URL = os.environ['RAW_EVENT_QUEUE_URL']
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
    Fetch recent publications from PubMed for pharmaceutical molecules
    """
    try:
        results = []
        
        # Calculate date range (last 24 hours)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=1)
        
        for molecule in MOLECULES:
            try:
                # Search PubMed for the molecule
                search_results = search_pubmed(molecule, start_date, end_date)
                
                for article in search_results:
                    # Create event payload
                    event_data = {
                        'source': 'PubMed',
                        'molecule': molecule,
                        'title': article.get('title', ''),
                        'abstract': article.get('abstract', ''),
                        'authors': article.get('authors', []),
                        'journal': article.get('journal', ''),
                        'pub_date': article.get('pub_date', ''),
                        'pmid': article.get('pmid', ''),
                        'url': f"https://pubmed.ncbi.nlm.nih.gov/{article.get('pmid', '')}/",
                        'timestamp': datetime.now().isoformat(),
                        'event_id': str(uuid.uuid4())
                    }
                    
                    # Send to SQS
                    sqs.send_message(
                        QueueUrl=QUEUE_URL,
                        MessageBody=json.dumps(event_data),
                        MessageAttributes={
                            'source': {'StringValue': 'PubMed', 'DataType': 'String'},
                            'molecule': {'StringValue': molecule, 'DataType': 'String'}
                        }
                    )
                    
                    results.append(event_data)
                    
            except Exception as e:
                print(f"Error processing molecule {molecule}: {str(e)}")
                continue
        
        # Store raw data in S3
        s3_key = f"raw/pubmed/{datetime.now().strftime('%Y/%m/%d')}/{datetime.now().strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=DATA_BUCKET,
            Key=s3_key,
            Body=json.dumps(results, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully processed {len(results)} articles',
                'articles_count': len(results),
                's3_location': f's3://{DATA_BUCKET}/{s3_key}'
            })
        }
        
    except Exception as e:
        print(f"Error in PubMed ingestion: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def search_pubmed(molecule, start_date, end_date):
    """
    Search PubMed for articles about a specific molecule
    """
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    
    # Format dates for PubMed API
    start_str = start_date.strftime('%Y/%m/%d')
    end_str = end_date.strftime('%Y/%m/%d')
    
    # Build search query
    query = f'("{molecule}"[Title/Abstract] OR "{molecule}"[MeSH Terms]) AND ("{start_str}"[Date - Publication] : "{end_str}"[Date - Publication])'
    
    # Search for PMIDs
    search_url = f"{base_url}esearch.fcgi"
    search_params = {
        'db': 'pubmed',
        'term': query,
        'retmax': 50,  # Limit results
        'retmode': 'json',
        'sort': 'pub+date'
    }
    
    try:
        search_response = requests.get(search_url, params=search_params, timeout=30)
        search_response.raise_for_status()
        search_data = search_response.json()
        
        pmids = search_data.get('esearchresult', {}).get('idlist', [])
        
        if not pmids:
            return []
        
        # Fetch article details
        fetch_url = f"{base_url}efetch.fcgi"
        fetch_params = {
            'db': 'pubmed',
            'id': ','.join(pmids),
            'retmode': 'xml'
        }
        
        fetch_response = requests.get(fetch_url, params=fetch_params, timeout=30)
        fetch_response.raise_for_status()
        
        # Parse XML response
        articles = parse_pubmed_xml(fetch_response.text)
        return articles
        
    except Exception as e:
        print(f"Error searching PubMed for {molecule}: {str(e)}")
        return []

def parse_pubmed_xml(xml_content):
    """
    Parse PubMed XML response to extract article information
    """
    articles = []
    
    try:
        root = ET.fromstring(xml_content)
        
        for article_elem in root.findall('.//PubmedArticle'):
            try:
                # Extract PMID
                pmid_elem = article_elem.find('.//PMID')
                pmid = pmid_elem.text if pmid_elem is not None else ''
                
                # Extract title
                title_elem = article_elem.find('.//ArticleTitle')
                title = title_elem.text if title_elem is not None else ''
                
                # Extract abstract
                abstract_elem = article_elem.find('.//AbstractText')
                abstract = abstract_elem.text if abstract_elem is not None else ''
                
                # Extract journal
                journal_elem = article_elem.find('.//Journal/Title')
                journal = journal_elem.text if journal_elem is not None else ''
                
                # Extract publication date
                pub_date_elem = article_elem.find('.//PubDate')
                pub_date = ''
                if pub_date_elem is not None:
                    year = pub_date_elem.find('Year')
                    month = pub_date_elem.find('Month')
                    day = pub_date_elem.find('Day')
                    
                    if year is not None:
                        pub_date = year.text
                        if month is not None:
                            pub_date += f"-{month.text}"
                            if day is not None:
                                pub_date += f"-{day.text}"
                
                # Extract authors
                authors = []
                for author_elem in article_elem.findall('.//Author'):
                    last_name = author_elem.find('LastName')
                    first_name = author_elem.find('ForeName')
                    
                    if last_name is not None and first_name is not None:
                        authors.append(f"{first_name.text} {last_name.text}")
                
                article = {
                    'pmid': pmid,
                    'title': title,
                    'abstract': abstract,
                    'journal': journal,
                    'pub_date': pub_date,
                    'authors': authors
                }
                
                articles.append(article)
                
            except Exception as e:
                print(f"Error parsing article: {str(e)}")
                continue
                
    except Exception as e:
        print(f"Error parsing PubMed XML: {str(e)}")
    
    return articles