import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { news } from "../../data/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function NewsDetails({params}){
  const item=news.find(n=>n.slug===params.slug);
  if(!item) return <div className="public-page"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>Actualité introuvable</h1><button className="primary-button" onClick={()=>navigate('/news')}>Retour</button></div></main><Footer/></div>;
  return <div className="public-page"><PublicHeader/><main>
    <article className="article-page"><button className="text-link" onClick={()=>navigate('/news')}>← Toutes les actualités</button><div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div><h1>{item.title}</h1><p className="article-lead">{item.excerpt}</p><div className="article-body"><p>{item.body}</p><blockquote>Terra Nova évolue en continu : les informations importantes sont également relayées dans les espaces citoyens.</blockquote><p>Pour toute question liée à cette information, vous pouvez contacter le service concerné depuis la page Contact ou votre espace personnel.</p></div></article>
  </main><Footer/></div>;
}
