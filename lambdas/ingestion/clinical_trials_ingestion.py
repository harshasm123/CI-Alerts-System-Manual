import json
import os
import boto3
import requests
from datetime import datetime, timedelta
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
    Fetch recent clinical trials from ClinicalTrials.gov for pharmaceutical molecules
    """
    try:
        results = []
        
        # Calculate date range (last 7 days for clinical trials)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        for molecule in MOLECULES:
            try:
                # Search ClinicalTrials.gov for the molecule
                trials = search_clinical_trials(molecule, start_date, end_date)
                
                for trial in trials:
                    # Create event payload
                    event_data = {
                        'source': 'ClinicalTrials.gov',
                        'molecule': molecule,
                        'nct_id': trial.get('nct_id', ''),
                        'title': trial.get('title', ''),
                        'brief_summary': trial.get('brief_summary', ''),
                        'detailed_description': trial.get('detailed_description', ''),
                        'phase': trial.get('phase', ''),
                        'status': trial.get('status', ''),
                        'start_date': trial.get('start_date', ''),
                        'completion_date': trial.get('completion_date', ''),
                        'sponsor': trial.get('sponsor', ''),
                        'conditions': trial.get('conditions', []),
                        'interventions': trial.get('interventions', []),
                        'url': f"https://clinicaltrials.gov/ct2/show/{trial.get('nct_id', '')}",
                        'timestamp': datetime.now().isoformat(),
                        'event_id': str(uuid.uuid4())
                    }
                    
                    # Send to SQS
                    sqs.send_message(
                        QueueUrl=QUEUE_URL,
                        MessageBody=json.dumps(event_data),
                        MessageAttributes={
                            'source': {'StringValue': 'ClinicalTrials.gov', 'DataType': 'String'},
                            'molecule': {'StringValue': molecule, 'DataType': 'String'}
                        }
                    )
                    
                    results.append(event_data)
                    
            except Exception as e:
                print(f"Error processing molecule {molecule}: {str(e)}")
                continue
        
        # Store raw data in S3
        s3_key = f"raw/clinical_trials/{datetime.now().strftime('%Y/%m/%d')}/{datetime.now().strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=DATA_BUCKET,
            Key=s3_key,
            Body=json.dumps(results, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully processed {len(results)} clinical trials',
                'trials_count': len(results),
                's3_location': f's3://{DATA_BUCKET}/{s3_key}'
            })
        }
        
    except Exception as e:
        print(f"Error in Clinical Trials ingestion: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def search_clinical_trials(molecule, start_date, end_date):
    """
    Search ClinicalTrials.gov for trials involving a specific molecule
    """
    base_url = "https://clinicaltrials.gov/api/query/study_fields"
    
    # Format dates for API
    start_str = start_date.strftime('%m/%d/%Y')
    end_str = end_date.strftime('%m/%d/%Y')
    
    params = {
        'expr': f'"{molecule}"',
        'fields': 'NCTId,BriefTitle,BriefSummary,DetailedDescription,Phase,OverallStatus,StartDate,CompletionDate,LeadSponsorName,Condition,InterventionName',
        'min_rnk': 1,
        'max_rnk': 50,  # Limit results
        'fmt': 'json'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        trials = []
        study_fields = data.get('StudyFieldsResponse', {}).get('StudyFields', [])
        
        for study in study_fields:
            try:
                # Extract fields safely
                nct_id = get_field_value(study, 'NCTId')
                title = get_field_value(study, 'BriefTitle')
                brief_summary = get_field_value(study, 'BriefSummary')
                detailed_description = get_field_value(study, 'DetailedDescription')
                phase = get_field_value(study, 'Phase')
                status = get_field_value(study, 'OverallStatus')
                start_date = get_field_value(study, 'StartDate')
                completion_date = get_field_value(study, 'CompletionDate')
                sponsor = get_field_value(study, 'LeadSponsorName')
                
                # Extract arrays
                conditions = get_field_values(study, 'Condition')
                interventions = get_field_values(study, 'InterventionName')
                
                trial = {
                    'nct_id': nct_id,
                    'title': title,
                    'brief_summary': brief_summary,
                    'detailed_description': detailed_description,
                    'phase': phase,
                    'status': status,
                    'start_date': start_date,
                    'completion_date': completion_date,
                    'sponsor': sponsor,
                    'conditions': conditions,
                    'interventions': interventions
                }
                
                trials.append(trial)
                
            except Exception as e:
                print(f"Error parsing trial: {str(e)}")
                continue
        
        return trials
        
    except Exception as e:
        print(f"Error searching Clinical Trials for {molecule}: {str(e)}")
        return []

def get_field_value(study, field_name):
    """
    Safely extract a single field value from study data
    """
    try:
        field_data = next((field for field in study if field.get('Field') == field_name), None)
        if field_data and 'Values' in field_data and field_data['Values']:
            return field_data['Values'][0]
    except Exception:
        pass
    return ''

def get_field_values(study, field_name):
    """
    Safely extract multiple field values from study data
    """
    try:
        field_data = next((field for field in study if field.get('Field') == field_name), None)
        if field_data and 'Values' in field_data:
            return field_data['Values']
    except Exception:
        pass
    return []