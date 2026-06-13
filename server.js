const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// Render가 제공하는 포트를 사용하고, 없으면 3000번을 사용하도록 설정
const PORT = process.env.PORT || 3000;

// 정적 파일(HTML, CSS, JS)을 제공하기 위한 폴더 설정
app.use(express.static(path.join(__dirname, 'public')));

// 사용자가 메인 주소로 들어왔을 때 index.html을 강제로 안전하게 열어줌
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 핵심 프록시 API: 프론트엔드에서 요청한 URL의 HTML을 대신 가져옴
app.get('/api/proxy', async (req, res) => {
    let targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('URL 주소가 필요합니다.');
    }

    // URL 자동 프로토콜(https://) 보정
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        // 실제 브라우저처럼 보이도록 User-Agent 및 헤더 설정 (차단 방지)
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000 // 타임아웃을 10초로 늘림
        });

        let html = response.data;

        // [🔥 이미지 썸네일 깨짐 방지 정밀 보정 작업]
        try {
            const urlObj = new URL(targetUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            
            // 1. 프로토콜이 생략된 주소 (예: src="//i.ytimg.com/..." -> src="https://i.ytimg.com/...") 보정
            html = html.replace(/(src|href|srcset)="(\/\/)/g, `$1="https://`);

            // 2. 루트 상대 경로 (예: src="/assets/..." -> src="https://youtube.com/assets/...") 보정
            html = html.replace(/(src|href|srcset)="\/([^\/])/g, `$1="${baseUrl}/$2`);

            // 3. 유튜브/인스타 등에서 사용하는 지연 로딩(Lazy Load)용 이미지 속성 강제 활성화
            html = html.replace(/data-thumb="/g, 'src="');
            html = html.replace(/data-src="/g, 'src="');

            // 4. 유튜브 자체 보안 정책(CSP) 메타 태그가 있다면 내 서버 우회를 방해하므로 제거
            html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

        } catch (e) {
            console.error('URL 정밀 변환 실패:', e.message);
        }

        // 가져온 HTML 데이터를 프론트엔드에 반환
        res.send(html);
    } catch (error) {
        console.error('프록시 에러:', error.message);
        res.status(500).send(`사이트를 불러올 수 없습니다. <br>원인: ${error.message}<br><br>* CORS 및 X-Frame-Options는 우회했으나, 해당 사이트에서 봇(Bot) 접속으로 감지해 차단했거나 웹 표준을 따르지 않는 구조일 수 있습니다.`);
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  [업그레이드 완료: 사이트 뷰어 서버 구동]`);
    console.log(`  포트 번호: ${PORT}`);
    console.log(`====================================================`);
});