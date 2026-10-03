import { useEffect, useMemo, useState } from "react";
import {
  clearRegistrationContext,
  completeRegistrationProfile,
  getApiErrorMessage,
  getRegistrationContext,
} from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import { navigate, roleHome } from "../../utils/navigation.js";
import { useLocale } from "../../utils/i18n.js";
import { updateProfile } from "../../api/account.js";
import "../auth.css";

const COPY = {
  fr: {
    checking:"Vérification en cours…", invalid:"Lien de vérification incomplet.", expired:"Lien invalide ou expiré.",
    verified:"Votre adresse e-mail est vérifiée.", account:"Compte citoyen", title:"E-mail vérifié",
    choiceTitle:"Souhaitez-vous compléter votre profil maintenant ?",
    choiceText:"Ces informations permettent de préparer vos démarches et vos rendez-vous. Vous pourrez aussi les modifier plus tard dans Mon profil.",
    continueProfile:"Compléter mon profil", skip:"Passer pour le moment", later:"Vous pourrez revenir sur ces informations à tout moment.",
    step1:"Étape 1 sur 2", personal:"Informations personnelles", personalText:"Quelques informations utiles pour les services municipaux.",
    step2:"Étape 2 sur 2", addressTitle:"Adresse et secteur", addressText:"Ces informations facilitent l’orientation de vos démarches.",
    first:"Prénom", last:"Nom", profession:"Profession", gender:"Genre", birth:"Date de naissance", phone:"Téléphone",
    female:"Femme", male:"Homme", other:"Autre", prefer:"Préfère ne pas préciser",
    address:"Adresse", habitat:"Habitat / résidence", district:"Quartier / district", sector:"Secteur", street:"Rue", building:"Bâtiment", apartment:"Appartement",
    next:"Continuer", back:"Retour", save:"Terminer mon profil", saving:"Enregistrement…", profileError:"Impossible d’enregistrer le profil.",
    done:"Profil complété", doneText:"Votre profil est enregistré. Vous pouvez maintenant accéder à votre espace Nova Terra.", enter:"Accéder à mon espace",
    unavailable:"Le jeton d’inscription n’est plus disponible. Vous pouvez compléter les mêmes informations depuis Mon profil.",
  },
  en: {
    checking:"Verifying…", invalid:"The verification link is incomplete.", expired:"The link is invalid or expired.",
    verified:"Your email address is verified.", account:"Citizen account", title:"Email verified",
    choiceTitle:"Would you like to complete your profile now?",
    choiceText:"These details help prepare your city requests and appointments. You can also edit them later in My profile.",
    continueProfile:"Complete my profile", skip:"Skip for now", later:"You can update this information at any time.",
    step1:"Step 1 of 2", personal:"Personal information", personalText:"A few useful details for city services.",
    step2:"Step 2 of 2", addressTitle:"Address and area", addressText:"These details help route your requests correctly.",
    first:"First name", last:"Last name", profession:"Profession", gender:"Gender", birth:"Date of birth", phone:"Phone",
    female:"Female", male:"Male", other:"Other", prefer:"Prefer not to say",
    address:"Address", habitat:"Residence / habitat", district:"District", sector:"Sector", street:"Street", building:"Building", apartment:"Apartment",
    next:"Continue", back:"Back", save:"Finish my profile", saving:"Saving…", profileError:"Unable to save the profile.",
    done:"Profile completed", doneText:"Your profile has been saved. You can now access your Nova Terra space.", enter:"Enter my space",
    unavailable:"The registration token is no longer available. You can complete the same information from My profile.",
  },
  mg: {
    checking:"Manamarina…", invalid:"Tsy feno ny rohy fanamarinana.", expired:"Tsy manankery na lany daty ny rohy.",
    verified:"Voamarina ny adiresy mailakao.", account:"Kaontin'ny mponina", title:"Voamarina ny mailaka",
    choiceTitle:"Te hameno ny mombamomba anao izao ve ianao?",
    choiceText:"Manampy amin'ny fangatahana sy fotoana fihaonana ireo vaovao ireo. Afaka ovaina any aoriana ao amin'ny mombamomba anao ihany koa.",
    continueProfile:"Hameno ny mombamomba", skip:"Handalo aloha", later:"Afaka manova ireo vaovao ireo ianao amin'ny fotoana rehetra.",
    step1:"Dingana 1 amin'ny 2", personal:"Mombamomba manokana", personalText:"Vaovao vitsivitsy ilaina amin'ny sampan-draharahan'ny tanàna.",
    step2:"Dingana 2 amin'ny 2", addressTitle:"Adiresy sy faritra", addressText:"Manampy amin'ny fandefasana ny fangatahana amin'ny toerana mety izany.",
    first:"Anarana", last:"Fanampin'anarana", profession:"Asa", gender:"Lahy/Vavy", birth:"Daty nahaterahana", phone:"Telefaona",
    female:"Vavy", male:"Lahy", other:"Hafa", prefer:"Tsy te hilaza",
    address:"Adiresy", habitat:"Toeram-ponenana", district:"Quartier / district", sector:"Secteur", street:"Arabe", building:"Trano", apartment:"Appartement",
    next:"Hanohy", back:"Hiverina", save:"Hamita ny mombamomba", saving:"Mitahiry…", profileError:"Tsy afaka mitahiry ny mombamomba.",
    done:"Vita ny mombamomba", doneText:"Voatahiry ny mombamomba anao. Afaka miditra amin'ny habaka Nova Terra ianao.", enter:"Hiditra amin'ny habaka",
    unavailable:"Tsy misy intsony ny jeton d'inscription. Afaka mameno ireo vaovao ireo ao amin'ny mombamomba anao ianao.",
  },
};


export default function VerifyEmailPage() {
  const { user, verifyEmail, replaceUser, refreshUser } = useAuth();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const registration = useMemo(() => getRegistrationContext(), []);
  const [status, setStatus] = useState({ type: "info", message: copy.checking });
  const [verified, setVerified] = useState(false);
  const [stage,setStage]=useState("verify");
  const [profileStep,setProfileStep]=useState(1);
  const [saving,setSaving]=useState(false);
  const [profileError,setProfileError]=useState("");
  const [form,setForm]=useState({
    first_name:registration?.first_name||"",
    last_name:registration?.last_name||"",
    profession:"",
    gender:"prefer_not_to_say",
    birth_date:"",
    phone_number:"",
    address:"",
    habitat:"",
    district:"",
    sector:"",
    street:"",
    building:"",
    apartment:"",
  });

  useEffect(() => {
    let mounted = true;
    if (!uid || !token) {
      setStatus({ type: "error", message: copy.invalid });
      return undefined;
    }

    verifyEmail({ uid, token })
      .then((data) => {
        if (!mounted) return;
        setVerified(true);
        setStatus({ type: "success", message: data.message || copy.verified });
        setForm(current=>({
          ...current,
          first_name:current.first_name||data.user?.first_name||"",
          last_name:current.last_name||data.user?.last_name||"",
          phone_number:current.phone_number||data.user?.phone_number||"",
        }));
        setStage("choice");
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus({ type: "error", message: getApiErrorMessage(error, copy.expired) });
      });

    return () => { mounted = false; };
  }, [token, uid, verifyEmail]);

  function skipProfile(){
    clearRegistrationContext();
    navigate(roleHome(user?.role||"citizen"),{replace:true});
  }

  function startProfile(){
    const registrationMatches = !registration?.email || !user?.email || String(registration.email).toLowerCase() === String(user.email).toLowerCase();
    if(!registration?.token || !registrationMatches){
      if(!registrationMatches)clearRegistrationContext();
      clearRegistrationContext();
      navigate("/citizen/profile?welcome=1",{replace:true});
      return;
    }
    setProfileError("");
    setStage("profile");
    setProfileStep(1);
  }

  async function submitProfile(event){
    event.preventDefault();
    setSaving(true);setProfileError("");
    try{
      const payload={
        ...form,
        birth_date:form.birth_date||undefined,
        sector:form.sector||undefined,
        street:form.street||undefined,
        building:form.building||undefined,
        apartment:form.apartment||undefined,
        locale,
      };
      let data;
      try{
        data=await completeRegistrationProfile(payload);
      }catch(error){
        const detail=`${error?.response?.data?.detail||error?.message||""} ${JSON.stringify(error?.response?.data?.errors||{})}`.toLowerCase();
        const tokenProblem=error?.response?.status===400 && (detail.includes("token")||detail.includes("jeton")||detail.includes("registration_token"));
        if(!tokenProblem)throw error;
        const updated=await updateProfile(payload);
        clearRegistrationContext();
        data={user:updated};
      }
      if(data?.user)replaceUser(data.user);
      else {
        try{await refreshUser()}catch{}
      }
      setStage("done");
    }catch(error){
      setProfileError(getApiErrorMessage(error,error?.message||copy.profileError));
    }finally{setSaving(false)}
  }

  return (
    <main className="auth-screen auth-screen--register-flow auth-screen--post-verify">
      <LanguageSwitcher className="auth-language-switcher" compact />
      <a className="auth-flow-brand" href="/" onClick={(event)=>{event.preventDefault();navigate("/")}}>Nova<span>Terra</span></a>

      <section className="auth-centered-card auth-centered-card--post-verify" aria-labelledby="verify-title">
        <div className={`auth-step-icon ${verified?"is-success":""}`} aria-hidden="true">{verified?"✓":"✉"}</div>

        {stage==="verify"?<>
          <span className="auth-mini-kicker">{copy.account}</span>
          <h1 id="verify-title">{copy.title}</h1>
          <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error"?"alert":"status"}>{status.message}</p>
        </>:null}

        {stage==="choice"?<>
          <span className="auth-mini-kicker">{copy.verified}</span>
          <h1 id="verify-title">{copy.choiceTitle}</h1>
          <p className="auth-choice-copy">{copy.choiceText}</p>
          {!registration?.token?<p className="auth-feedback auth-feedback--info">{copy.unavailable}</p>:null}
          <div className="auth-post-verify-actions">
            <button className="auth-primary-button" type="button" onClick={startProfile}><span>{copy.continueProfile}</span><span className="auth-button-arrow">→</span></button>
            <button className="auth-secondary-button" type="button" onClick={skipProfile}>{copy.skip}</button>
          </div>
          <small>{copy.later}</small>
        </>:null}

        {stage==="profile"?<form className="profile-form profile-form--registration" onSubmit={submitProfile}>
          <div className="register-progress">
            <span>{profileStep===1?copy.step1:copy.step2}</span>
            <div><i className="is-active"/><i className={profileStep===2?"is-active":""}/></div>
          </div>

          {profileStep===1?<>
            <div className="auth-profile-heading"><h2>{copy.personal}</h2><p>{copy.personalText}</p></div>
            <div className="auth-grid-two">
              <label className="auth-modern-field"><span>{copy.first}</span><input required value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.last}</span><input required value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.profession}</span><input required value={form.profession} onChange={e=>setForm({...form,profession:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.gender}</span><select required value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="female">{copy.female}</option><option value="male">{copy.male}</option><option value="other">{copy.other}</option><option value="prefer_not_to_say">{copy.prefer}</option></select></label>
              <label className="auth-modern-field"><span>{copy.birth}</span><input type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.phone}</span><input required type="tel" value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})} placeholder="+261..."/></label>
            </div>
            <div className="profile-actions profile-actions--wide"><button type="button" onClick={skipProfile}>{copy.skip}</button><button type="button" className="auth-primary-inline" onClick={()=>setProfileStep(2)} disabled={!form.first_name||!form.last_name||!form.profession||!form.phone_number}>{copy.next} →</button></div>
          </>:<>
            <div className="auth-profile-heading"><h2>{copy.addressTitle}</h2><p>{copy.addressText}</p></div>
            <div className="auth-grid-two">
              <label className="auth-modern-field"><span>{copy.address}</span><input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.habitat}</span><input required value={form.habitat} onChange={e=>setForm({...form,habitat:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.district}</span><input required value={form.district} onChange={e=>setForm({...form,district:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.sector}</span><input value={form.sector} onChange={e=>setForm({...form,sector:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.street}</span><input value={form.street} onChange={e=>setForm({...form,street:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.building}</span><input value={form.building} onChange={e=>setForm({...form,building:e.target.value})}/></label>
              <label className="auth-modern-field"><span>{copy.apartment}</span><input value={form.apartment} onChange={e=>setForm({...form,apartment:e.target.value})}/></label>
            </div>
            {profileError?<p className="auth-feedback auth-feedback--error" role="alert">{profileError}</p>:null}
            <div className="profile-actions profile-actions--wide"><button type="button" onClick={()=>setProfileStep(1)}>← {copy.back}</button><button className="auth-primary-inline" type="submit" disabled={saving||!form.address||!form.habitat||!form.district}>{saving?copy.saving:copy.save}</button></div>
            <button className="auth-secondary-link" type="button" onClick={skipProfile}>{copy.skip}</button>
          </>}
        </form>:null}

        {stage==="done"?<>
          <span className="auth-mini-kicker">{copy.done}</span>
          <h1 id="verify-title">{copy.done}</h1>
          <p className="auth-choice-copy">{copy.doneText}</p>
          <button className="auth-primary-button auth-post-verify-enter" type="button" onClick={()=>navigate(roleHome(user?.role||"citizen"),{replace:true})}><span>{copy.enter}</span><span className="auth-button-arrow">→</span></button>
        </>:null}
      </section>
    </main>
  );
}
