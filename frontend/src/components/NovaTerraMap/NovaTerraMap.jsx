import { useEffect, useMemo, useRef, useState } from "react";
import { buildServiceLocations } from "./locations.js";
import { navigate } from "../../utils/navigation.js";
import "./NovaTerraMap.css";

const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

function cssColor(name,fallback){
  const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value||fallback;
}

function categoryKey(text=""){
  return String(text).trim().toLowerCase().replaceAll("é","e").replaceAll("è","e").replaceAll("ê","e");
}

function createFallbackPositions(locations){
  const minX=-6,maxX=6,minZ=-6,maxZ=6;
  return locations.map(item=>({
    ...item,
    left:`${((item.position[0]-minX)/(maxX-minX))*100}%`,
    top:`${((item.position[2]-minZ)/(maxZ-minZ))*100}%`,
  }));
}

export default function NovaTerraMap({services=[],visibleSlugs=null,locale="fr"}){
  const mountRef=useRef(null);
  const rendererRef=useRef(null);
  const cameraRef=useRef(null);
  const focusRef=useRef({x:0,z:0,angle:Math.PI/4,zoom:1});
  const animationRef=useRef(null);
  const meshMapRef=useRef(new Map());
  const selectedSlugRef=useRef("");
  const [engine,setEngine]=useState("loading");
  const [selectedSlug,setSelectedSlug]=useState(()=>services[0]?.slug||"");
  const [a11yVersion,setA11yVersion]=useState(0);

  const locations=useMemo(()=>buildServiceLocations(services),[services]);
  const fallbackPositions=useMemo(()=>createFallbackPositions(locations),[locations]);
  const selected=useMemo(
    ()=>locations.find(item=>item.slug===selectedSlug&&(!visibleSlugs||visibleSlugs.has(item.slug)))
      || locations.find(item=>!visibleSlugs||visibleSlugs.has(item.slug))
      || null,
    [locations,selectedSlug,visibleSlugs]
  );

  useEffect(()=>{
    if(selected&&selected.slug!==selectedSlug)setSelectedSlug(selected.slug);
  },[selected,selectedSlug]);

  useEffect(()=>{
    selectedSlugRef.current=selectedSlug;
  },[selectedSlug]);

  useEffect(()=>{
    const onA11y=()=>setA11yVersion(value=>value+1);
    window.addEventListener("nova-accessibility-change",onA11y);
    return()=>window.removeEventListener("nova-accessibility-change",onA11y);
  },[]);

  useEffect(()=>{
    let disposed=false;
    let renderer=null;
    let resizeObserver=null;
    let cleanupEvents=()=>{};

    async function start(){
      const host=mountRef.current;
      if(!host)return;
      host.innerHTML="";
      setEngine("loading");

      try{
        const THREE=await import(/* @vite-ignore */ THREE_URL);
        if(disposed||!mountRef.current)return;

        const scene=new THREE.Scene();
        scene.background=null;

        const width=Math.max(host.clientWidth,320);
        const height=Math.max(host.clientHeight,320);
        const aspect=width/height;
        const frustum=8.8;
        const camera=new THREE.OrthographicCamera(
          -frustum*aspect,
          frustum*aspect,
          frustum,
          -frustum,
          .1,
          100
        );
        cameraRef.current=camera;

        renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
        renderer.setSize(width,height,false);
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.domElement.className="nova-city-map__canvas";
        renderer.domElement.setAttribute("aria-hidden","true");
        host.appendChild(renderer.domElement);
        rendererRef.current=renderer;

        const cityGroup=new THREE.Group();
        scene.add(cityGroup);

        const baseColor=cssColor("--tn-card","#ffffff");
        const lineColor=cssColor("--tn-line","#ded8e6");
        const accentColor=cssColor("--tn-purple","#6b18df");
        const highContrast=document.documentElement.dataset.contrast==="high";

        const hemi=new THREE.HemisphereLight(
          highContrast?0xffffff:0xf7f2ff,
          highContrast?0x111111:0xbac4d8,
          1.35
        );
        scene.add(hemi);
        const sun=new THREE.DirectionalLight(0xffffff,1.55);
        sun.position.set(7,14,9);
        scene.add(sun);

        const groundMat=new THREE.MeshStandardMaterial({
          color:new THREE.Color(baseColor),
          roughness:.96,
          metalness:0,
        });
        const ground=new THREE.Mesh(new THREE.BoxGeometry(15,.22,13),groundMat);
        ground.position.y=-.17;
        cityGroup.add(ground);

        const roadColor=highContrast?0x2b2b2b:0xcbd0dc;
        const roadMat=new THREE.MeshStandardMaterial({color:roadColor,roughness:1});
        const addRoad=(x,z,w,d,rotation=0)=>{
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,.045,d),roadMat);
          mesh.position.set(x,.005,z);
          mesh.rotation.y=rotation;
          cityGroup.add(mesh);
        };
        addRoad(0,0,14,.78,0);
        addRoad(0,0,.78,12,0);
        addRoad(0,0,10,.62,Math.PI/4);
        addRoad(0,0,10,.62,-Math.PI/4);

        const parkMat=new THREE.MeshStandardMaterial({color:highContrast?0x151515:0xcfe8d6,roughness:1});
        const park=new THREE.Mesh(new THREE.BoxGeometry(3.2,.055,2.1),parkMat);
        park.position.set(-.2,.02,1.2);
        park.rotation.y=.14;
        cityGroup.add(park);

        const trunkMat=new THREE.MeshStandardMaterial({color:highContrast?0x777777:0x9b7257,roughness:1});
        const leafMat=new THREE.MeshStandardMaterial({color:highContrast?0xf2d34b:0x68b27b,roughness:.85});
        [[-1.15,1.55],[.7,1.5],[-.1,.65],[1.1,.7],[-.8,.25]].forEach(([x,z])=>{
          const tree=new THREE.Group();
          const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.55,8),trunkMat);
          trunk.position.y=.29;
          const leaves=new THREE.Mesh(new THREE.SphereGeometry(.32,12,10),leafMat);
          leaves.position.y=.73;
          tree.add(trunk,leaves);
          tree.position.set(x,0,z);
          cityGroup.add(tree);
        });

        const meshes=[];
        const meshMap=new Map();
        meshMapRef.current=meshMap;

        locations.forEach((location,index)=>{
          const [x,,z]=location.position;
          const [w,h,d]=location.size;
          const isVisible=!visibleSlugs||visibleSlugs.has(location.slug);
          const color=highContrast?new THREE.Color(accentColor):new THREE.Color(location.color);
          const material=new THREE.MeshStandardMaterial({
            color,
            roughness:.62,
            metalness:.03,
            transparent:true,
            opacity:isVisible?1:.18,
          });

          const group=new THREE.Group();
          group.position.set(x,0,z);
          group.userData={location};

          const building=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
          building.position.y=h/2;
          building.userData={location,isBuilding:true};
          group.add(building);
          meshes.push(building);

          const roofMaterial=new THREE.MeshStandardMaterial({
            color:highContrast?0xffffff:new THREE.Color(location.color).offsetHSL(0,0,.12),
            roughness:.7,
            transparent:true,
            opacity:isVisible?1:.18,
          });
          const roof=new THREE.Mesh(new THREE.BoxGeometry(w*.62,.18,d*.62),roofMaterial);
          roof.position.y=h+.1;
          roof.userData={location,isBuilding:true};
          group.add(roof);
          meshes.push(roof);

          const markerMat=new THREE.MeshBasicMaterial({
            color:highContrast?0xf2d34b:0xffffff,
            transparent:true,
            opacity:isVisible?1:.18,
          });
          const marker=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.08,18),markerMat);
          marker.position.y=h+.35;
          marker.rotation.x=Math.PI/2;
          marker.userData={location,isBuilding:true};
          group.add(marker);
          meshes.push(marker);

          cityGroup.add(group);
          meshMap.set(location.slug,{group,building,roof,marker,material,roofMaterial,markerMat,index});
        });

        const plazaMat=new THREE.MeshStandardMaterial({color:highContrast?0x111111:0xe9e5f1,roughness:1});
        const plaza=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,.08,36),plazaMat);
        plaza.position.set(0,.04,0);
        cityGroup.add(plaza);

        const focus=focusRef.current;
        function updateCamera(){
          const radius=15;
          camera.position.set(
            focus.x+Math.cos(focus.angle)*radius,
            12.5,
            focus.z+Math.sin(focus.angle)*radius
          );
          camera.lookAt(focus.x,0,focus.z);
          camera.zoom=focus.zoom;
          camera.updateProjectionMatrix();
        }
        updateCamera();

        const raycaster=new THREE.Raycaster();
        const pointer=new THREE.Vector2();
        let hovered=null;
        let dragging=false;
        let dragStartX=0;
        let dragStartAngle=focus.angle;
        let moved=false;

        function pointerFromEvent(event){
          const rect=renderer.domElement.getBoundingClientRect();
          pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
          pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
        }

        function restoreHover(){
          if(!hovered)return;
          const item=meshMap.get(hovered.userData.location.slug);
          if(item){
            const selectedNow=hovered.userData.location.slug===selectedSlugRef.current;
            item.group.scale.setScalar(selectedNow?1.055:1);
          }
          hovered=null;
          renderer.domElement.style.cursor=dragging?"grabbing":"grab";
        }

        function onMove(event){
          if(dragging){
            const delta=event.clientX-dragStartX;
            if(Math.abs(delta)>3)moved=true;
            focus.angle=dragStartAngle-delta*.0085;
            updateCamera();
            return;
          }
          pointerFromEvent(event);
          raycaster.setFromCamera(pointer,camera);
          const hit=raycaster.intersectObjects(meshes,false)[0]?.object||null;
          if(hit!==hovered){
            restoreHover();
            if(hit){
              hovered=hit;
              const item=meshMap.get(hit.userData.location.slug);
              if(item)item.group.scale.setScalar(1.055);
              renderer.domElement.style.cursor="pointer";
            }
          }
        }

        function onPointerDown(event){
          dragging=true;
          moved=false;
          dragStartX=event.clientX;
          dragStartAngle=focus.angle;
          renderer.domElement.setPointerCapture?.(event.pointerId);
          renderer.domElement.style.cursor="grabbing";
        }

        function onPointerUp(event){
          dragging=false;
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          renderer.domElement.style.cursor="grab";
          if(moved)return;
          pointerFromEvent(event);
          raycaster.setFromCamera(pointer,camera);
          const hit=raycaster.intersectObjects(meshes,false)[0]?.object;
          if(hit?.userData?.location)setSelectedSlug(hit.userData.location.slug);
        }

        function onWheel(event){
          event.preventDefault();
          focus.zoom=Math.min(1.65,Math.max(.72,focus.zoom-(event.deltaY*.0011)));
          updateCamera();
        }

        renderer.domElement.style.cursor="grab";
        renderer.domElement.addEventListener("pointermove",onMove);
        renderer.domElement.addEventListener("pointerdown",onPointerDown);
        renderer.domElement.addEventListener("pointerup",onPointerUp);
        renderer.domElement.addEventListener("pointerleave",restoreHover);
        renderer.domElement.addEventListener("wheel",onWheel,{passive:false});

        cleanupEvents=()=>{
          renderer?.domElement.removeEventListener("pointermove",onMove);
          renderer?.domElement.removeEventListener("pointerdown",onPointerDown);
          renderer?.domElement.removeEventListener("pointerup",onPointerUp);
          renderer?.domElement.removeEventListener("pointerleave",restoreHover);
          renderer?.domElement.removeEventListener("wheel",onWheel);
        };

        resizeObserver=new ResizeObserver(()=>{
          if(!host||!renderer)return;
          const nextW=Math.max(host.clientWidth,320);
          const nextH=Math.max(host.clientHeight,320);
          const nextAspect=nextW/nextH;
          camera.left=-frustum*nextAspect;
          camera.right=frustum*nextAspect;
          camera.top=frustum;
          camera.bottom=-frustum;
          camera.updateProjectionMatrix();
          renderer.setSize(nextW,nextH,false);
        });
        resizeObserver.observe(host);

        function animate(){
          if(disposed)return;
          locations.forEach(location=>{
            const item=meshMap.get(location.slug);
            if(!item)return;
            const selectedNow=location.slug===selectedSlugRef.current;
            const visibleNow=!visibleSlugs||visibleSlugs.has(location.slug);
            const targetScale=selectedNow?1.075:1;
            item.group.scale.lerp(new THREE.Vector3(targetScale,targetScale,targetScale),.14);
            const targetOpacity=visibleNow?1:.16;
            item.material.opacity+=(targetOpacity-item.material.opacity)*.15;
            item.roofMaterial.opacity+=(targetOpacity-item.roofMaterial.opacity)*.15;
            item.markerMat.opacity+=(targetOpacity-item.markerMat.opacity)*.15;
          });
          renderer.render(scene,camera);
          animationRef.current=requestAnimationFrame(animate);
        }
        animate();
        setEngine("ready");
      }catch(error){
        console.warn("Nova Terra 3D map fallback:",error);
        if(!disposed)setEngine("fallback");
      }
    }

    start();
    return()=>{
      disposed=true;
      if(animationRef.current)cancelAnimationFrame(animationRef.current);
      cleanupEvents();
      resizeObserver?.disconnect();
      renderer?.dispose();
      if(mountRef.current)mountRef.current.innerHTML="";
      rendererRef.current=null;
      cameraRef.current=null;
      meshMapRef.current.clear();
    };
  },[locations,visibleSlugs,a11yVersion]);

  useEffect(()=>{
    if(!selected)return;
    const focus=focusRef.current;
    focus.x=selected.position[0];
    focus.z=selected.position[2];
    const camera=cameraRef.current;
    if(camera){
      const radius=15;
      camera.position.set(
        focus.x+Math.cos(focus.angle)*radius,
        12.5,
        focus.z+Math.sin(focus.angle)*radius
      );
      camera.lookAt(focus.x,0,focus.z);
      camera.updateProjectionMatrix();
    }
  },[selected]);

  const copy={
    fr:{
      title:"Plan 3D de Nova Terra",hint:"Glissez pour tourner · molette pour zoomer",list:"Lieux accessibles",details:"Informations du lieu",open:"Ouvrir le service",locate:"Localiser",fallback:"Vue 3D indisponible : navigation accessible activée.",empty:"Aucun service dans ce filtre.",hours:"Horaires",address:"Adresse"
    },
    en:{
      title:"Nova Terra 3D map",hint:"Drag to rotate · wheel to zoom",list:"Accessible locations",details:"Location information",open:"Open service",locate:"Locate",fallback:"3D view unavailable: accessible map mode enabled.",empty:"No service matches this filter.",hours:"Opening hours",address:"Address"
    },
    mg:{
      title:"Sarintany 3D Nova Terra",hint:"Sintomy hampihodina · kodiarana hanakaiky",list:"Toerana azo isafidianana",details:"Mombamomba ny toerana",open:"Hijery ny sampan-draharaha",locate:"Hampifantoka",fallback:"Tsy mandeha ny 3D: alefa ny sarintany mora idirana.",empty:"Tsy misy sampan-draharaha amin'ity sivana ity.",hours:"Ora fisokafana",address:"Adiresy"
    }
  }[locale]||null;

  const visibleLocations=locations.filter(item=>!visibleSlugs||visibleSlugs.has(item.slug));

  return <section className="nova-city-map" aria-label={copy.title}>
    <header className="nova-city-map__header">
      <div><span className="section-label">Nova Terra</span><h3>{copy.title}</h3></div>
      <span>{copy.hint}</span>
    </header>

    <div className="nova-city-map__layout">
      <div className="nova-city-map__scene-card">
        <div className="nova-city-map__scene">
          <div className="nova-city-map__webgl" ref={mountRef}/>
          {engine==="loading"?<div className="nova-city-map__loading"><i/><span>Chargement de la ville 3D…</span></div>:null}
          {engine==="fallback"?<div className="nova-city-map__fallback" aria-hidden="true">
            <div className="nova-city-map__fallback-roads"/>
            {fallbackPositions.map(location=>{
              const visible=!visibleSlugs||visibleSlugs.has(location.slug);
              return <button
                type="button"
                key={location.slug}
                className={`nova-city-map__fallback-building ${selectedSlug===location.slug?"is-selected":""}`}
                style={{left:location.left,top:location.top,"--building":location.color,opacity:visible?1:.18}}
                tabIndex="-1"
                aria-hidden="true"
                onClick={()=>setSelectedSlug(location.slug)}
              ><span>{location.icon}</span></button>;
            })}
          </div>:null}
        </div>
        {engine==="fallback"?<p className="nova-city-map__fallback-note">{copy.fallback}</p>:null}
      </div>

      <aside className="nova-city-map__panel">
        {selected?<div className="nova-city-map__selected">
          <div className="nova-city-map__selected-icon" style={{"--location-color":selected.color}} aria-hidden="true">{selected.icon}</div>
          <span>{selected.category}</span>
          <h3>{selected.name}</h3>
          <p>{selected.description}</p>
          <dl>
            <div><dt>{copy.address}</dt><dd>{selected.address||selected.district}</dd></div>
            {selected.openingHours?<div><dt>{copy.hours}</dt><dd>{selected.openingHours}</dd></div>:null}
          </dl>
          <button type="button" className="primary-action" onClick={()=>navigate(`/citizen/services/${selected.slug}`)}>{copy.open} →</button>
        </div>:<div className="nova-city-map__empty">{copy.empty}</div>}

        <div className="nova-city-map__accessible-list">
          <span className="section-label">{copy.list}</span>
          {visibleLocations.length?visibleLocations.map(location=><button
            type="button"
            key={location.slug}
            className={selectedSlug===location.slug?"is-active":""}
            aria-pressed={selectedSlug===location.slug}
            onClick={()=>setSelectedSlug(location.slug)}
          >
            <i style={{"--location-color":location.color}} aria-hidden="true">{location.icon}</i>
            <span><b>{location.name}</b><small>{location.category}</small></span>
            <em>{copy.locate}</em>
          </button>):<p>{copy.empty}</p>}
        </div>
      </aside>
    </div>
  </section>;
}
