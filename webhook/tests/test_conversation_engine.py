import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from conversation_engine import ConversationEngine


class Store:
    def __init__(self): self.states={}; self.done={}
    def empty_state(self): return {"intent":None,"draft":{},"phase":"idle","validation":{},"last_reference":None}
    def get(self,p): return self.states.get(p,self.empty_state())
    def save(self,p,s): self.states[p]=dict(s)
    def reset(self,p): self.states.pop(p,None)
    def get_processed(self,r): return self.done.get(r)
    def mark_processed(self,r,p,reply):
        if r: self.done[r]=reply


class Citizen: pass


class Bridge:
    def find_citizen(self,p): return Citizen()
    def context(self,c): return {"agents":[],"services":[],"report_categories":[]}
    def validate(self,intent,draft,c):
        if intent=="report" and all(draft.get(k) for k in ("title","description","location_text")):
            return {"valid":True,"errors":{}}
        return {"valid":False,"errors":{"location_text":["required"]}}
    def execute(self,intent,draft,c): return {"reference":"NT-R-TEST","kind":"report","emergency":False}
    def status(self,ref,c): return f"{ref}: En traitement."


class Gemini:
    def interpret(self,**kw):
        return {"intent":"report","slots":{"title":"Fuite","description":"Fuite d'eau","location_text":"Rue 1"}}
    def answer_info(self,**kw): return "Info"


def test_requires_final_confirmation_before_write():
    store=Store(); bridge=Bridge(); gemini=Gemini()
    engine=ConversationEngine(store=store,bridge=bridge,gemini=gemini)
    first=engine.process(phone="+261340000000",text="Il y a une fuite rue 1",client_reference="m1")
    assert "CONFIRMER" in first
    assert store.states["+261340000000"]["phase"]=="confirm"
    second=engine.process(phone="+261340000000",text="CONFIRMER",client_reference="m2")
    assert "NT-R-TEST" in second
    assert "+261340000000" not in store.states


def test_idempotent_client_reference():
    store=Store(); engine=ConversationEngine(store=store,bridge=Bridge(),gemini=Gemini())
    a=engine.process(phone="+261340000000",text="fuite",client_reference="same")
    b=engine.process(phone="+261340000000",text="autre",client_reference="same")
    assert a==b
