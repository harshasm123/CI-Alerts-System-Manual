# Healthcare & Pharmaceutical Data Sources

## 🎯 Currently Implemented (3 Sources)

### 1. **PubMed / NCBI**
- **URL:** https://pubmed.ncbi.nlm.nih.gov/
- **API:** https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
- **Coverage:** 35+ million biomedical research articles
- **Update Frequency:** Daily (our system: nightly at midnight UTC)
- **Data Type:** Research papers, clinical studies, systematic reviews
- **Cost:** Free
- **Implementation:** ✅ `lambdas/ingestion/pubmed_ingestion.py`

### 2. **ClinicalTrials.gov**
- **URL:** https://clinicaltrials.gov/
- **API:** https://clinicaltrials.gov/api/query/study_fields
- **Coverage:** 400,000+ clinical trials worldwide
- **Update Frequency:** Real-time (our system: nightly)
- **Data Type:** Trial protocols, status, results, sponsors, phases
- **Cost:** Free
- **Implementation:** ✅ `lambdas/ingestion/clinical_trials_ingestion.py`

### 3. **FDA openFDA**
- **URL:** https://open.fda.gov/
- **API:** https://api.fda.gov/
- **Coverage:** Drug approvals, adverse events, recalls, labels
- **Update Frequency:** Weekly (our system: nightly)
- **Data Type:** Regulatory data, safety alerts, drug labels
- **Cost:** Free (1,000 requests/day without API key, 240,000/day with key)
- **Implementation:** ✅ `lambdas/ingestion/fda_ingestion.py`

---

## 🚀 Recommended Additional Sources (High Priority)

### 4. **EMA (European Medicines Agency)**
- **URL:** https://www.ema.europa.eu/
- **API:** https://www.ema.europa.eu/en/medicines/download-medicine-data
- **Coverage:** EU drug approvals, safety data, clinical assessments
- **Update Frequency:** Weekly
- **Data Type:** Marketing authorizations, EPAR (European Public Assessment Reports)
- **Cost:** Free
- **Value:** European regulatory intelligence, competitor EU strategies
- **Implementation Effort:** Medium (REST API available)

### 5. **WHO ICTRP (International Clinical Trials Registry Platform)**
- **URL:** https://www.who.int/clinical-trials-registry-platform
- **API:** https://trialsearch.who.int/
- **Coverage:** Global trial registries (17 primary registries)
- **Update Frequency:** Weekly
- **Data Type:** International trials not in ClinicalTrials.gov
- **Cost:** Free
- **Value:** Global competitive intelligence, emerging markets
- **Implementation Effort:** Medium

### 6. **Patent Databases (USPTO, EPO, WIPO)**
- **USPTO:** https://developer.uspto.gov/
- **EPO:** https://www.epo.org/searching-for-patents/data/web-services.html
- **WIPO:** https://patentscope.wipo.int/
- **Coverage:** Pharmaceutical patents, exclusivity data
- **Update Frequency:** Weekly
- **Data Type:** Patent filings, approvals, expirations, claims
- **Cost:** Free
- **Value:** Competitive IP landscape, biosimilar opportunities
- **Implementation Effort:** High (complex APIs, legal parsing)

### 7. **SEC EDGAR (Financial Filings)**
- **URL:** https://www.sec.gov/edgar
- **API:** https://www.sec.gov/edgar/sec-api-documentation
- **Coverage:** Public company financial disclosures (10-K, 10-Q, 8-K)
- **Update Frequency:** Real-time
- **Data Type:** Pipeline updates, trial results, partnerships, M&A
- **Cost:** Free
- **Value:** Competitor financial health, strategic moves
- **Implementation Effort:** Medium (text parsing required)

### 8. **BioMedTracker / Pharmaprojects (Commercial)**
- **URL:** https://citeline.informa.com/
- **API:** Available with subscription
- **Coverage:** Curated drug pipeline database
- **Update Frequency:** Daily
- **Data Type:** Pipeline status, probability of success, market forecasts
- **Cost:** $10K-50K/year
- **Value:** High-quality curated data, predictive analytics
- **Implementation Effort:** Low (structured API)

---

## 📊 Additional Free Sources (Medium Priority)

### 9. **PubChem**
- **URL:** https://pubchem.ncbi.nlm.nih.gov/
- **API:** https://pubchemdocs.ncbi.nlm.nih.gov/pug-rest
- **Coverage:** 110+ million chemical compounds
- **Data Type:** Chemical structures, properties, bioactivity data
- **Cost:** Free
- **Value:** Compound analysis, mechanism of action insights

### 10. **DrugBank**
- **URL:** https://go.drugbank.com/
- **API:** https://docs.drugbank.com/v1/
- **Coverage:** 14,000+ drugs, 5,000+ targets
- **Data Type:** Drug interactions, targets, pharmacology
- **Cost:** Free (academic), $2K-10K/year (commercial)
- **Value:** Drug mechanism, interaction analysis

### 11. **ChEMBL**
- **URL:** https://www.ebi.ac.uk/chembl/
- **API:** https://chembl.gitbook.io/chembl-interface-documentation/web-services
- **Coverage:** 2.4M+ compounds, 1.4M+ assays
- **Data Type:** Bioactivity data, drug discovery data
- **Cost:** Free
- **Value:** Preclinical data, target validation

### 12. **ClinVar**
- **URL:** https://www.ncbi.nlm.nih.gov/clinvar/
- **API:** https://www.ncbi.nlm.nih.gov/clinvar/docs/api_http/
- **Coverage:** Genetic variants and clinical significance
- **Data Type:** Genomic data, variant interpretations
- **Cost:** Free
- **Value:** Precision medicine, biomarker discovery

### 13. **FAERS (FDA Adverse Event Reporting System)**
- **URL:** https://open.fda.gov/data/faers/
- **API:** https://api.fda.gov/drug/event.json
- **Coverage:** 10M+ adverse event reports
- **Data Type:** Post-market safety surveillance
- **Cost:** Free
- **Value:** Safety signal detection, competitor drug issues

### 14. **Orange Book (FDA Approved Drugs)**
- **URL:** https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files
- **API:** Part of openFDA
- **Coverage:** All FDA-approved drugs with exclusivity data
- **Data Type:** Approval dates, exclusivity periods, generic availability
- **Cost:** Free
- **Value:** Market exclusivity tracking, generic competition

### 15. **Purple Book (Biosimilars)**
- **URL:** https://www.fda.gov/drugs/biosimilars/purple-book-lists-licensed-biological-products
- **API:** Downloadable database
- **Coverage:** Biosimilar and interchangeable products
- **Data Type:** Biosimilar approvals, reference products
- **Cost:** Free
- **Value:** Biosimilar competitive landscape

---

## 🌍 International Regulatory Sources

### 16. **Health Canada Drug Product Database**
- **URL:** https://health-products.canada.ca/dpd-bdpp/
- **API:** Available
- **Coverage:** Canadian drug approvals
- **Cost:** Free

### 17. **PMDA (Japan Pharmaceuticals and Medical Devices Agency)**
- **URL:** https://www.pmda.go.jp/english/
- **API:** Limited
- **Coverage:** Japanese drug approvals
- **Cost:** Free

### 18. **NMPA (China National Medical Products Administration)**
- **URL:** https://www.nmpa.gov.cn/
- **API:** Limited (Chinese language)
- **Coverage:** Chinese drug approvals
- **Cost:** Free

### 19. **TGA (Australia Therapeutic Goods Administration)**
- **URL:** https://www.tga.gov.au/
- **API:** Available
- **Coverage:** Australian drug approvals
- **Cost:** Free

### 20. **Swissmedic**
- **URL:** https://www.swissmedic.ch/
- **API:** Limited
- **Coverage:** Swiss drug approvals
- **Cost:** Free

---

## 📰 News & Market Intelligence Sources

### 21. **BioSpace**
- **URL:** https://www.biospace.com/
- **API:** RSS feeds available
- **Coverage:** Pharma/biotech news, job postings
- **Cost:** Free
- **Value:** Industry trends, company announcements

### 22. **FiercePharma**
- **URL:** https://www.fiercepharma.com/
- **API:** RSS feeds
- **Coverage:** Pharma industry news
- **Cost:** Free
- **Value:** Breaking news, market analysis

### 23. **STAT News**
- **URL:** https://www.statnews.com/
- **API:** RSS feeds
- **Coverage:** Healthcare and pharma journalism
- **Cost:** Free (limited), $299/year (premium)
- **Value:** Investigative reporting, insider news

### 24. **Endpoints News**
- **URL:** https://endpts.com/
- **API:** RSS feeds
- **Coverage:** Biotech news, clinical trial results
- **Cost:** Free
- **Value:** Real-time trial data, FDA decisions

### 25. **PharmaCompass**
- **URL:** https://www.pharmacompass.com/
- **API:** Available with subscription
- **Coverage:** API manufacturers, drug pricing
- **Cost:** Subscription-based
- **Value:** Supply chain intelligence

---

## 🔬 Scientific Literature Sources

### 26. **bioRxiv / medRxiv**
- **URL:** https://www.biorxiv.org/, https://www.medrxiv.org/
- **API:** https://api.biorxiv.org/
- **Coverage:** Preprint research papers
- **Cost:** Free
- **Value:** Early access to research before peer review

### 27. **Google Scholar**
- **URL:** https://scholar.google.com/
- **API:** Unofficial (SerpAPI)
- **Coverage:** Academic papers across all sources
- **Cost:** Free (limited scraping)
- **Value:** Comprehensive literature search

### 28. **Semantic Scholar**
- **URL:** https://www.semanticscholar.org/
- **API:** https://api.semanticscholar.org/
- **Coverage:** 200M+ papers with AI-powered insights
- **Cost:** Free
- **Value:** Citation analysis, influential papers

### 29. **Europe PMC**
- **URL:** https://europepmc.org/
- **API:** https://europepmc.org/RestfulWebService
- **Coverage:** 40M+ life science publications
- **Cost:** Free
- **Value:** European research, full-text access

### 30. **Cochrane Library**
- **URL:** https://www.cochranelibrary.com/
- **API:** Limited
- **Coverage:** Systematic reviews, meta-analyses
- **Cost:** Free (some content)
- **Value:** Evidence-based medicine, treatment efficacy

---

## 💰 Market & Commercial Intelligence

### 31. **IQVIA (Commercial)**
- **URL:** https://www.iqvia.com/
- **API:** Available with subscription
- **Coverage:** Prescription data, market share, sales forecasts
- **Cost:** $50K-500K/year
- **Value:** Market sizing, competitive positioning

### 32. **GlobalData Pharma (Commercial)**
- **URL:** https://www.globaldata.com/
- **API:** Available
- **Coverage:** Pipeline analysis, market forecasts
- **Cost:** $10K-100K/year
- **Value:** Competitive intelligence, market trends

### 33. **Evaluate Pharma (Commercial)**
- **URL:** https://www.evaluate.com/
- **API:** Available
- **Coverage:** Consensus forecasts, pipeline valuations
- **Cost:** $20K-50K/year
- **Value:** Financial modeling, deal analysis

### 34. **Cortellis (Clarivate) (Commercial)**
- **URL:** https://clarivate.com/cortellis/
- **API:** Available
- **Coverage:** Drug pipeline, competitive intelligence
- **Cost:** $30K-100K/year
- **Value:** Comprehensive pipeline tracking

---

## 🧬 Genomics & Precision Medicine

### 35. **ClinGen**
- **URL:** https://clinicalgenome.org/
- **API:** Available
- **Coverage:** Gene-disease relationships
- **Cost:** Free
- **Value:** Precision medicine, target validation

### 36. **gnomAD**
- **URL:** https://gnomad.broadinstitute.org/
- **API:** Available
- **Coverage:** Population genetics data
- **Cost:** Free
- **Value:** Variant frequency, drug target validation

### 37. **TCGA (The Cancer Genome Atlas)**
- **URL:** https://www.cancer.gov/tcga
- **API:** https://portal.gdc.cancer.gov/
- **Coverage:** Cancer genomics data
- **Cost:** Free
- **Value:** Oncology drug development insights

---

## 🏥 Real-World Evidence Sources

### 38. **Medicare Claims Data (CMS)**
- **URL:** https://www.cms.gov/Research-Statistics-Data-and-Systems
- **API:** Available
- **Coverage:** US Medicare claims, utilization data
- **Cost:** Free (limited), paid for detailed data
- **Value:** Real-world drug utilization, outcomes

### 39. **SEER (Surveillance, Epidemiology, and End Results)**
- **URL:** https://seer.cancer.gov/
- **API:** Available
- **Coverage:** Cancer incidence and survival data
- **Cost:** Free
- **Value:** Epidemiology, market sizing for oncology

### 40. **UK Biobank**
- **URL:** https://www.ukbiobank.ac.uk/
- **API:** Application required
- **Coverage:** 500K+ participants, genetic and health data
- **Cost:** Free (academic), application required
- **Value:** Real-world outcomes, biomarker validation

---

## 📋 Implementation Priority Matrix

| Priority | Source | Value | Cost | Effort | ROI |
|----------|--------|-------|------|--------|-----|
| **HIGH** | EMA | High | Free | Medium | ⭐⭐⭐⭐⭐ |
| **HIGH** | WHO ICTRP | High | Free | Medium | ⭐⭐⭐⭐⭐ |
| **HIGH** | SEC EDGAR | High | Free | Medium | ⭐⭐⭐⭐⭐ |
| **HIGH** | FAERS | High | Free | Low | ⭐⭐⭐⭐⭐ |
| **HIGH** | Orange/Purple Book | High | Free | Low | ⭐⭐⭐⭐⭐ |
| **MEDIUM** | Patent DBs | High | Free | High | ⭐⭐⭐⭐ |
| **MEDIUM** | bioRxiv/medRxiv | Medium | Free | Low | ⭐⭐⭐⭐ |
| **MEDIUM** | News Sources | Medium | Free | Low | ⭐⭐⭐⭐ |
| **MEDIUM** | DrugBank | Medium | $2K-10K | Low | ⭐⭐⭐ |
| **LOW** | Commercial DBs | Very High | $10K-500K | Low | ⭐⭐ |

---

## 🔧 Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)
1. ✅ PubMed (Done)
2. ✅ ClinicalTrials.gov (Done)
3. ✅ FDA openFDA (Done)
4. 🔲 FAERS (FDA Adverse Events)
5. 🔲 Orange/Purple Book
6. 🔲 bioRxiv/medRxiv

### Phase 2: Regulatory Expansion (2-4 weeks)
7. 🔲 EMA (European approvals)
8. 🔲 WHO ICTRP (Global trials)
9. 🔲 Health Canada
10. 🔲 TGA Australia

### Phase 3: Market Intelligence (4-6 weeks)
11. 🔲 SEC EDGAR (Financial filings)
12. 🔲 News aggregation (RSS feeds)
13. 🔲 Patent databases (USPTO, EPO)

### Phase 4: Scientific Depth (6-8 weeks)
14. 🔲 DrugBank (Drug interactions)
15. 🔲 ChEMBL (Bioactivity)
16. 🔲 PubChem (Chemical data)
17. 🔲 Semantic Scholar (Citation analysis)

### Phase 5: Commercial Data (Optional)
18. 🔲 Evaluate commercial subscriptions (IQVIA, GlobalData)
19. 🔲 Negotiate API access
20. 🔲 Integrate premium sources

---

## 💡 Data Source Selection Criteria

### Evaluate Each Source On:
1. **Relevance:** Does it provide pharmaceutical competitive intelligence?
2. **Coverage:** How comprehensive is the data?
3. **Freshness:** How often is it updated?
4. **Cost:** Free vs paid, API limits
5. **API Quality:** REST API, rate limits, documentation
6. **Legal:** Terms of service, commercial use allowed
7. **Implementation Effort:** Easy, medium, or complex integration
8. **ROI:** Value delivered vs cost and effort

---

## 🎯 Current System Architecture

```
Data Sources (3 currently)
    ├─ PubMed API (research papers)
    ├─ ClinicalTrials.gov API (trials)
    └─ FDA openFDA API (regulatory)
         ↓
EventBridge (Scheduled: Midnight UTC)
         ↓
Lambda Ingestion Functions
         ↓
SQS Queue (Raw Events)
         ↓
Lambda Processor (Claude 3.5 Haiku)
         ↓
DynamoDB (Insights) + S3 (Knowledge Base)
         ↓
OpenSearch Serverless (Vector Search)
         ↓
Bedrock Agent (RAG Chat)
```

### Adding New Sources:
1. Create new Lambda function in `lambdas/ingestion/`
2. Add EventBridge rule in CDK stack
3. Use same SQS queue for processing
4. Processor Lambda handles all sources uniformly
5. No changes needed to downstream components

---

## 📊 Data Volume Estimates

| Source | Daily Updates | Monthly Volume | Storage/Month |
|--------|--------------|----------------|---------------|
| PubMed | 1,000-2,000 | 30K-60K | 500MB |
| ClinicalTrials | 100-200 | 3K-6K | 100MB |
| FDA | 50-100 | 1.5K-3K | 50MB |
| **Current Total** | **1,150-2,300** | **34.5K-69K** | **650MB** |
| | | | |
| + EMA | 50-100 | 1.5K-3K | 50MB |
| + WHO ICTRP | 200-300 | 6K-9K | 150MB |
| + FAERS | 500-1,000 | 15K-30K | 300MB |
| + News (RSS) | 100-200 | 3K-6K | 50MB |
| + Patents | 50-100 | 1.5K-3K | 100MB |
| **Projected Total** | **2,050-4,000** | **61.5K-120K** | **1.3GB** |

### Cost Impact:
- **Current:** $135/month
- **With 10 sources:** ~$180/month (+$45)
- **With 20 sources:** ~$250/month (+$115)

Still significantly cheaper than commercial alternatives ($10K-500K/year)

---

## 🔐 API Key Management

### Sources Requiring API Keys:
- FDA openFDA (optional, increases rate limit)
- DrugBank (commercial use)
- Semantic Scholar (optional, higher limits)
- Commercial sources (IQVIA, GlobalData, etc.)

### Store in AWS Secrets Manager:
```python
import boto3
secrets = boto3.client('secretsmanager')

# Retrieve API key
secret = secrets.get_secret_value(SecretId='pharma-intel/api-keys')
api_keys = json.loads(secret['SecretString'])
fda_key = api_keys['fda_api_key']
```

---

## 📚 Additional Resources

### Documentation:
- **PubMed API:** https://www.ncbi.nlm.nih.gov/books/NBK25501/
- **ClinicalTrials API:** https://clinicaltrials.gov/api/gui
- **FDA API:** https://open.fda.gov/apis/
- **EMA API:** https://www.ema.europa.eu/en/about-us/how-we-work/big-data

### Best Practices:
- Respect rate limits (implement exponential backoff)
- Cache responses when appropriate
- Use batch APIs when available
- Monitor API health and quotas
- Implement circuit breakers for failing APIs
- Log all API calls for debugging

---

**Total Available Sources:** 40+ (3 implemented, 37 potential additions)

**Recommended Next Steps:**
1. Implement FAERS (adverse events) - High value, low effort
2. Add EMA (European regulatory) - High value, medium effort
3. Integrate SEC EDGAR (financial intelligence) - High value, medium effort
4. Add news RSS feeds - Medium value, low effort
5. Evaluate commercial subscriptions based on budget and needs
