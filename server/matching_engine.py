
import json

def calculate_match(student_skills, project_requirements):
    """
    Calcule un score de compatibilité entre un étudiant et un projet.
    """
    score = 0
    skills_set = set([s.lower() for s in student_skills])
    req_set = set([r.lower() for r in project_requirements])
    
    # Intersection des compétences
    match = skills_set.intersection(req_set)
    score += len(match) * 20
    
    # Bonus pour les compétences rares
    rare_skills = {"react", "python", "data science", "ia"}
    for skill in match:
        if skill in rare_skills:
            score += 10
            
    return min(score, 100)

def main():
    # Exemple de données
    aideur = {
        "name": "Amine",
        "skills": ["Python", "React", "SQL"]
    }
    
    project = {
        "title": "Aide Dashboard S2",
        "requirements": ["React", "CSS"]
    }
    
    match_score = calculate_match(aideur["skills"], project["requirements"])
    print(f"Match Score for {aideur['name']}: {match_score}%")

if __name__ == "__main__":
    main()
