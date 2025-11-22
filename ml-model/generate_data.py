import pandas as pd
import numpy as np
import random

def generate_approval_status(category, budget, footfall):
    """
    Applies the core business rules to determine if a proposal should be approved (1) or rejected (0).
    """
    
    # Calculate budget per person (BPP)
    bpp = budget / footfall if footfall > 0 else 0
    
    # Check general rule: BPP between 50 and 200
    bpp_condition = (bpp >= 50) and (bpp <= 200)
    
    is_approved = False
    
    # Apply category-specific rules
    if category == 'Technical':
        # Technical events: approved if budget < 200000
        is_approved = (budget < 200000) or bpp_condition
    
    elif category == 'Cultural':
        # Cultural events: approved if footfall > 300
        is_approved = (footfall > 300) or bpp_condition
        
    elif category == 'Sports':
        # Sports events: approved if budget < 150000
        is_approved = (budget < 150000) or bpp_condition
    
    elif category == 'Social' or category == 'Workshop':
        # For Social and Workshop, rely primarily on the BPP condition
        is_approved = bpp_condition

    # Convert boolean to integer (1 or 0)
    return 1 if is_approved else 0

def create_synthetic_data(num_rows=1000):
    """
    Generates a synthetic dataset for event proposal feasibility prediction.
    """
    
    categories = ['Technical', 'Cultural', 'Sports', 'Social', 'Workshop']
    
    # Define ranges (in Rupe