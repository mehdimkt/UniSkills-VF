
import random

def verify_student_card(card_id, university_name):
    """
    Simule la validation d'une carte étudiante par rapport à une base d'université.
    """
    # Logique simplifiée : les IDs valides doivent commencer par l'année 2024/2025
    valid_prefixes = ["24", "25", "UNI"]
    
    is_valid_format = any(card_id.startswith(p) for p in valid_prefixes)
    is_authorized_uni = university_name.lower() in ["um6p", "uapf", "encg", "emi", "ensam"]
    
    if is_valid_format and is_authorized_uni:
        return {
            "verified": True,
            "trust_score": random.randint(85, 99),
            "status": "APPROVED"
        }
    return {
        "verified": False,
        "trust_score": 0,
        "status": "REJECTED"
    }

if __name__ == "__main__":
    test_result = verify_student_card("25MAR123", "UM6P")
    print(f"Verification Result: {test_result}")
