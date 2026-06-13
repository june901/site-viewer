const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// ⭐️ [수정] Render가 제공하는 포트를 사용하고, 없으면 3000번을 사용하도록 변경
const PORT = process.env.PORT || 3000;

// 정적 파일(HTML, CSS, JS)을 제공하기 위한 폴더 설정
app.use(express.static(path.join(__dirname, 'public')));

// ⭐️ [추가] 사용자가 메인 주소로 들어왔을 때 index.html을 강제로 안전하게 열어줌
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
        // 실제 브라우저처럼 보이도록 User-Agent 설정 (차단 방지)
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 7000 // 7초 타임아웃
        });

        let html = response.data;

        // [간단한 주소 보정 작업]
        try {
            const urlObj = new URL(targetUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            
            // src="/..." 나 href="/..." 형태를 src="https://사이트/..." 형태로 일부 치환
            html = html.replace(/(src|href)="\/([^\/])/g, `$1="${baseUrl}/$2`);
        } catch (e) {
            console.error('URL 변환 실패:', e.message);
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
    console.log(`  [사이트 뷰어 서버 구동 완료]`);
    console.log(`  포트 번호: ${PORT}`);
    console.log(`====================================================`);
});