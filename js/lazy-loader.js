const placeholder=document.querySelector("#videos-placeholder");

const observer=new IntersectionObserver(async(entries)=>{

    if(!entries[0].isIntersecting) return;

    observer.disconnect();

    if(!document.querySelector("#videos-css")){
        const css=document.createElement("link");
        css.id="videos-css";
        css.rel="stylesheet";
        css.href="/css/videos.css";
        document.head.appendChild(css);
    }

    const html=await fetch("/sections/videos.html");
    placeholder.innerHTML=await html.text();

    const script=document.createElement("script");
    script.src="/js/videos.js";
    document.body.appendChild(script);

},{
    rootMargin:"300px"
});

observer.observe(placeholder);
