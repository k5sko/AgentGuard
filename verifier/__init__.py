"""AgentGuard — detect adversarial / malicious bug reports before they reach an
automated program-repair pipeline.

Layers:
    reality_check  — is the bug grounded in real code in the local clone?
    redflags       — does the requested change carry a malicious signature?
    classify       — optional LLM pre-APR filter (the paper's Fig. 4 defense)
    verify         — combine the above into a single OK/suspicious/problematic verdict
"""
