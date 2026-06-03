async function test() {
    try {
        const id = '9443503415';
        const res = await fetch(`http://127.0.0.1:3200/getSongListDetail?disstid=${id}`).then(r => r.json());
        const list = res?.response?.cdlist?.[0]?.songlist || [];
        console.log("SONG LIST LENGTH:", list.length);
        if (list.length > 0) {
            console.log("FIRST SONG KEYS:", Object.keys(list[0]));
            console.log("FIRST SONG ALBUMMID:", list[0].albummid);
            console.log("FIRST SONG ALBUM:", list[0].album);
            console.log("FIRST SONG ID/MID:", list[0].songmid, list[0].songid, list[0].mid);
        }
    } catch(e) {
        console.error("ERROR:", e);
    }
}
test();
