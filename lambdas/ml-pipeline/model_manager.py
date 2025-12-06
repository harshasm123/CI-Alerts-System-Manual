import boto3
import json
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class ModelManager:
    """Production-grade model management with monitoring and routing"""
    
    def __init__(self):
        self.bedrock = boto3.client('bedrock-runtime')
        self.cloudwatch = boto3.client('cloudwatch')
        self.ssm = boto3.client('ssm')
        
    def route_request(self, prompt: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Route request to appropriate model with monitoring"""
        
        model_config = self._get_model_config()
        start_time = time.time()
        
        try:
            response = self._invoke_model(model_config, prompt)
            duration = time.time() - start_time
            
            self._log_metrics(model_config['version'], 'success', duration, len(prompt))
            
            return {
                'success': True,
                'content': response.get('content', ''),
                'model_version': model_config['version'],
                'duration': duration
            }
            
        except Exception as e:
            duration = time.time() - start_time
            self._log_metrics(model_config['version'], 'error', duration, len(prompt), str(e))
            raise
    
    def _get_model_config(self) -> Dict[str, Any]:
        """Get current model configuration"""
        return {
            "id": "anthropic.claude-3-5-haiku-20241022-v1:0",
            "version": "v1.0",
            "max_tokens": 1000,
            "temperature": 0.7
        }
    
    def _invoke_model(self, model_config: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        """Invoke Bedrock model"""
        
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": model_config.get('max_tokens', 1000),
            "temperature": model_config.get('temperature', 0.7),
            "messages": [{"role": "user", "content": prompt}]
        }
        
        response = self.bedrock.invoke_model(
            modelId=model_config['id'],
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        
        return {
            'content': response_body.get('content', [{}])[0].get('text', ''),
            'usage': response_body.get('usage', {})
        }
    
    def _log_metrics(self, model_version: str, status: str, duration: float,
                    input_tokens: int, error_message: Optional[str] = None):
        """Log metrics to CloudWatch"""
        
        try:
            self.cloudwatch.put_metric_data(
                Namespace='CIAlert/ML',
                MetricData=[
                    {
                        'MetricName': 'ModelLatency',
                        'Value': duration,
                        'Unit': 'Seconds',
                        'Dimensions': [{'Name': 'ModelVersion', 'Value': model_version}]
                    },
                    {
                        'MetricName': 'ModelInvocations',
                        'Value': 1,
                        'Unit': 'Count',
                        'Dimensions': [{'Name': 'Status', 'Value': status}]
                    }
                ]
            )
        except Exception as e:
            print(f"Failed to log metrics: {e}")


class ABTestManager:
    """A/B testing framework for model experiments"""
    
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
    
    def get_variant(self, user_id: str, experiment_name: str) -> str:
        """Get variant assignment for user"""
        import hashlib
        
        hash_value = int(hashlib.md5(f"{user_id}_{experiment_name}".encode()).hexdigest(), 16)
        return 'treatment' if (hash_value % 100) < 20 else 'control'  # 20% treatment
    
    def log_conversion(self, user_id: str, experiment: str, metric_name: str, value: float):
        """Log conversion metric"""
        variant = self.get_variant(user_id, experiment)
        
        try:
            self.cloudwatch.put_metric_data(
                Namespace='CIAlert/Experiments',
                MetricData=[{
                    'MetricName': metric_name,
                    'Value': value,
                    'Dimensions': [
                        {'Name': 'Experiment', 'Value': experiment},
                        {'Name': 'Variant', 'Value': variant}
                    ]
                }]
            )
        except Exception as e:
            print(f"Failed to log conversion: {e}")