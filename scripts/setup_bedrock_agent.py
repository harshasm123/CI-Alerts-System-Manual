#!/usr/bin/env python3
"""
Script to set up Bedrock Agent and Knowledge Base for CI Alert System
"""

import boto3
import json
import time
import os
from typing import Dict, Any

class BedrockAgentSetup:
    def __init__(self, region: str = 'us-east-1'):
        self.region = region
        self.bedrock_agent = boto3.client('bedrock-agent', region_name=region)
        self.bedrock_agent_runtime = boto3.client('bedrock-agent-runtime', region_name=region)
        self.s3 = boto3.client('s3', region_name=region)
        self.iam = boto3.client('iam', region_name=region)
        
        # Configuration
        self.agent_name = 'ci-alert-agent'
        self.kb_name = 'ci-alert-knowledge-base'
        self.foundation_model = 'anthropic.claude-3-sonnet-20240229-v1:0'
        self.embedding_model = 'amazon.titan-embed-text-v1'
        
    def create_agent_role(self) -> str:
        """Create IAM role for Bedrock Agent"""
        role_name = f'{self.agent_name}-role'
        
        trust_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "bedrock.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        policy_document = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "bedrock:InvokeModel",
                        "bedrock:Retrieve",
                        "bedrock:RetrieveAndGenerate"
                    ],
                    "Resource": "*"
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:ListBucket"
                    ],
                    "Resource": [
                        f"arn:aws:s3:::ci-alert-data-*",
                        f"arn:aws:s3:::ci-alert-data-*/*"
                    ]
                }
            ]
        }
        
        try:
            # Create role
            role_response = self.iam.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(trust_policy),
                Description='Role for CI Alert Bedrock Agent'
            )
            
            # Attach inline policy
            self.iam.put_role_policy(
                RoleName=role_name,
                PolicyName=f'{role_name}-policy',
                PolicyDocument=json.dumps(policy_document)
            )
            
            print(f"Created IAM role: {role_name}")
            return role_response['Role']['Arn']
            
        except self.iam.exceptions.EntityAlreadyExistsException:
            # Role already exists, get its ARN
            role_response = self.iam.get_role(RoleName=role_name)
            print(f"Using existing IAM role: {role_name}")
            return role_response['Role']['Arn']
    
    def create_knowledge_base_role(self) -> str:
        """Create IAM role for Knowledge Base"""
        role_name = f'{self.kb_name}-role'
        
        trust_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "bedrock.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        policy_document = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "bedrock:InvokeModel"
                    ],
                    "Resource": f"arn:aws:bedrock:{self.region}::foundation-model/{self.embedding_model}"
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:ListBucket"
                    ],
                    "Resource": [
                        f"arn:aws:s3:::ci-alert-data-*",
                        f"arn:aws:s3:::ci-alert-data-*/*"
                    ]
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "aoss:APIAccessAll"
                    ],
                    "Resource": f"arn:aws:aoss:{self.region}:*:collection/*"
                }
            ]
        }
        
        try:
            # Create role
            role_response = self.iam.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(trust_policy),
                Description='Role for CI Alert Knowledge Base'
            )
            
            # Attach inline policy
            self.iam.put_role_policy(
                RoleName=role_name,
                PolicyName=f'{role_name}-policy',
                PolicyDocument=json.dumps(policy_document)
            )
            
            print(f"Created IAM role: {role_name}")
            return role_response['Role']['Arn']
            
        except self.iam.exceptions.EntityAlreadyExistsException:
            # Role already exists, get its ARN
            role_response = self.iam.get_role(RoleName=role_name)
            print(f"Using existing IAM role: {role_name}")
            return role_response['Role']['Arn']
    
    def create_knowledge_base(self, data_bucket: str, kb_role_arn: str) -> str:
        """Create Bedrock Knowledge Base"""
        try:
            # Check if knowledge base already exists
            existing_kbs = self.bedrock_agent.list_knowledge_bases()
            for kb in existing_kbs.get('knowledgeBaseSummaries', []):
                if kb['name'] == self.kb_name:
                    print(f"Using existing knowledge base: {self.kb_name}")
                    return kb['knowledgeBaseId']
            
            # Create knowledge base
            kb_response = self.bedrock_agent.create_knowledge_base(
                name=self.kb_name,
                description='Knowledge base for pharmaceutical competitive intelligence',
                roleArn=kb_role_arn,
                knowledgeBaseConfiguration={
                    'type': 'VECTOR',
                    'vectorKnowledgeBaseConfiguration': {
                        'embeddingModelArn': f'arn:aws:bedrock:{self.region}::foundation-model/{self.embedding_model}'
                    }
                },
                storageConfiguration={
                    'type': 'OPENSEARCH_SERVERLESS',
                    'opensearchServerlessConfiguration': {
                        'collectionArn': f'arn:aws:aoss:{self.region}:123456789012:collection/ci-alert-kb',
                        'vectorIndexName': 'ci-alert-index',
                        'fieldMapping': {
                            'vectorField': 'vector',
                            'textField': 'text',
                            'metadataField': 'metadata'
                        }
                    }
                }
            )
            
            kb_id = kb_response['knowledgeBase']['knowledgeBaseId']
            print(f"Created knowledge base: {self.kb_name} (ID: {kb_id})")
            
            # Create data source
            ds_response = self.bedrock_agent.create_data_source(
                knowledgeBaseId=kb_id,
                name=f'{self.kb_name}-data-source',
                description='S3 data source for CI insights',
                dataSourceConfiguration={
                    'type': 'S3',
                    's3Configuration': {
                        'bucketArn': f'arn:aws:s3:::{data_bucket}',
                        'inclusionPrefixes': ['processed/insights/']
                    }
                }
            )
            
            print(f"Created data source: {ds_response['dataSource']['dataSourceId']}")
            
            return kb_id
            
        except Exception as e:
            print(f"Error creating knowledge base: {str(e)}")
            raise
    
    def create_agent(self, agent_role_arn: str, kb_id: str) -> str:
        """Create Bedrock Agent"""
        try:
            # Check if agent already exists
            existing_agents = self.bedrock_agent.list_agents()
            for agent in existing_agents.get('agentSummaries', []):
                if agent['agentName'] == self.agent_name:
                    print(f"Using existing agent: {self.agent_name}")
                    return agent['agentId']
            
            # Create agent
            agent_response = self.bedrock_agent.create_agent(
                agentName=self.agent_name,
                description='Competitive intelligence agent for pharmaceutical industry',
                idleSessionTTLInSeconds=1800,
                foundationModel=self.foundation_model,
                instruction="""
You are a competitive intelligence analyst specializing in pharmaceutical and biotech news. 
Your role is to analyze drug development news, clinical trials, regulatory approvals, and patent information 
to provide actionable competitive intelligence insights.

When analyzing information, focus on:
1. Clinical trial updates and results
2. Regulatory approvals and rejections
3. Safety concerns and adverse events
4. Competitive landscape changes
5. Market impact potential
6. Patent developments
7. Company partnerships and acquisitions

Always provide:
- Relevance score (0.0 to 1.0)
- Impact level (HIGH, MEDIUM, LOW)
- Concise summary
- Competitive intelligence angle
- Key stakeholders involved

Be objective, factual, and focus on actionable insights for pharmaceutical professionals.
""",
                agentResourceRoleArn=agent_role_arn
            )
            
            agent_id = agent_response['agent']['agentId']
            print(f"Created agent: {self.agent_name} (ID: {agent_id})")
            
            # Associate knowledge base with agent
            if kb_id:
                self.bedrock_agent.associate_agent_knowledge_base(
                    agentId=agent_id,
                    agentVersion='DRAFT',
                    knowledgeBaseId=kb_id,
                    description='Historical pharmaceutical insights and molecule data',
                    knowledgeBaseState='ENABLED'
                )
                print(f"Associated knowledge base {kb_id} with agent {agent_id}")
            
            # Prepare agent
            self.bedrock_agent.prepare_agent(agentId=agent_id)
            print(f"Preparing agent {agent_id}...")
            
            # Wait for agent to be prepared
            max_attempts = 30
            for attempt in range(max_attempts):
                agent_status = self.bedrock_agent.get_agent(agentId=agent_id)
                status = agent_status['agent']['agentStatus']
                
                if status == 'PREPARED':
                    print(f"Agent {agent_id} is ready!")
                    break
                elif status == 'FAILED':
                    raise Exception(f"Agent preparation failed")
                
                print(f"Agent status: {status}, waiting...")
                time.sleep(10)
            
            return agent_id
            
        except Exception as e:
            print(f"Error creating agent: {str(e)}")
            raise
    
    def create_agent_alias(self, agent_id: str) -> str:
        """Create agent alias for production use"""
        try:
            alias_response = self.bedrock_agent.create_agent_alias(
                agentId=agent_id,
                agentAliasName='production',
                description='Production alias for CI Alert agent'
            )
            
            alias_id = alias_response['agentAlias']['agentAliasId']
            print(f"Created agent alias: {alias_id}")
            
            return alias_id
            
        except Exception as e:
            print(f"Error creating agent alias: {str(e)}")
            raise
    
    def setup_complete_system(self, data_bucket: str) -> Dict[str, str]:
        """Set up the complete Bedrock Agent system"""
        print("Setting up CI Alert Bedrock Agent system...")
        
        # Create IAM roles
        print("\n1. Creating IAM roles...")
        agent_role_arn = self.create_agent_role()
        kb_role_arn = self.create_knowledge_base_role()
        
        # Wait for roles to propagate
        print("Waiting for IAM roles to propagate...")
        time.sleep(30)
        
        # Create knowledge base
        print("\n2. Creating knowledge base...")
        kb_id = self.create_knowledge_base(data_bucket, kb_role_arn)
        
        # Create agent
        print("\n3. Creating agent...")
        agent_id = self.create_agent(agent_role_arn, kb_id)
        
        # Create agent alias
        print("\n4. Creating agent alias...")
        alias_id = self.create_agent_alias(agent_id)
        
        result = {
            'agent_id': agent_id,
            'agent_alias_id': alias_id,
            'knowledge_base_id': kb_id,
            'agent_role_arn': agent_role_arn,
            'kb_role_arn': kb_role_arn
        }
        
        print("\n✅ Bedrock Agent setup complete!")
        print(f"Agent ID: {agent_id}")
        print(f"Agent Alias ID: {alias_id}")
        print(f"Knowledge Base ID: {kb_id}")
        
        return result

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Set up Bedrock Agent for CI Alert System')
    parser.add_argument('--data-bucket', required=True, help='S3 bucket name for data storage')
    parser.add_argument('--region', default='us-east-1', help='AWS region')
    
    args = parser.parse_args()
    
    setup = BedrockAgentSetup(region=args.region)
    result = setup.setup_complete_system(args.data_bucket)
    
    # Save configuration
    config_file = 'bedrock_agent_config.json'
    with open(config_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\nConfiguration saved to {config_file}")

if __name__ == '__main__':
    main()