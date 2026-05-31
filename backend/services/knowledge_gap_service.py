"""
Knowledge Gap Detection Service for HELPDESK.AI.
Identifies recurring ticket themes that lack sufficient documentation in the Knowledge Base.
Resolves Issue #611.
"""
import logging
from typing import List, Dict, Any, Optional
from collections import Counter
import os

logger = logging.getLogger(__name__)

class KnowledgeGapService:
    def __init__(self, rag_service, classifier_service):
        self.rag_service = rag_service
        self.classifier_service = classifier_service

    def analyze_gaps(self, tickets: List[Dict[str, Any]], threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Processes a batch of tickets, clusters them by topic, 
        and checks for knowledge base coverage.
        """
        if not tickets:
            return []

        # 1. Identify common categories/topics from tickets
        # In a real-world scenario, we might use K-Means clustering on embeddings.
        # For this implementation, we'll use the classifier's category predictions.
        category_counts = Counter()
        category_tickets = {}

        for ticket in tickets:
            content = f"{ticket.get('title', '')} {ticket.get('description', '')}"
            # Use the existing classifier if available
            try:
                category = ticket.get('category')
                if not category and self.classifier_service:
                    result = self.classifier_service.classify(content)
                    category = result.get('category', 'Uncategorized')
            except Exception:
                category = 'Uncategorized'
            
            category_counts[category] += 1
            if category not in category_tickets:
                category_tickets[category] = []
            category_tickets[category].append(content)

        gaps = []

        # 2. For each frequent category, check if the RAG service finds high-quality matches
        for category, count in category_counts.most_common(10):
            # Only analyze categories with multiple tickets
            if count < 2:
                continue
                
            representative_text = category_tickets[category][0]
            
            match = None
            if self.rag_service:
                # Use a slightly lower threshold to detect "weak" matches
                match = self.rag_service.search_knowledge_base(representative_text, threshold=threshold)
            
            # If no match or low similarity match found, it's a gap
            if not match or match.get('similarity', 0) < threshold:
                gaps.append({
                    "topic": category,
                    "ticket_count": count,
                    "status": "Documentation Gap Identified",
                    "recommendation": f"Create a new Knowledge Base article for '{category}' issues.",
                    "existing_match_similarity": match.get('similarity', 0) if match else 0,
                    "sample_tickets": category_tickets[category][:3]
                })

        return sorted(gaps, key=lambda x: x['ticket_count'], reverse=True)

    def suggest_article_outline(self, topic: str, sample_tickets: List[str]) -> Dict[str, Any]:
        """
        Uses an LLM (via rag_service or similar) to generate a suggested outline for the new article.
        """
        # Placeholder for AI generation logic
        return {
            "title": f"Troubleshooting: {topic}",
            "sections": [
                "Issue Description",
                "Common Symptoms",
                "Resolution Steps",
                "Related Problems"
            ]
        }
