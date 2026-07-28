async function loadVideos(){

    const res = await fetch("/api/videos.json");
    const data = await res.json();

    const track=document.getElementById("videosTrack");

    track.innerHTML="";

    data.forEach(video=>{

        track.insertAdjacentHTML("beforeend",`

        <a class="video-card" href="${video.url}">
            <img loading="lazy" src="${video.thumbnail}" alt="">
            <div class="video-title">${video.title}</div>
        </a>

        `);

    });

    document.querySelector(".left").onclick=()=>{
        track.scrollBy({
            left:-500,
            behavior:"smooth"
        });
    };

    document.querySelector(".right").onclick=()=>{
        track.scrollBy({
            left:500,
            behavior:"smooth"
        });
    };

}

loadVideos();
