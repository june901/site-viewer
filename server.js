const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/proxy', async (req, res) => {
    let targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('URL 주소가 필요합니다.');
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000
        });

        let html = response.data;

        try {
            const urlObj = new URL(targetUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            
            // 1. 기본 프로토콜 및 루트 상대 경로 보정
            html = html.replace(/(src|href|srcset)="\/\/([^\/])/g, `$1="https://$2`);
            html = html.replace(/(src|srcset)="\/([^\/])/g, `$1="${baseUrl}/$2`);

            // ⚠️ 2. [핵심 추가] 모든 링크(href) 클릭 시 우리 프록시 서버를 거쳐 가도록 강제 치환
            // href="/profile" -> href="/api/proxy?url=https://site.com/profile"
            // href="https://site.com/page" -> href="/api/proxy?url=https://site.com/page"
            
            // 일반 외부 링크 치환
            html = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, p1) => {
                return `href="/api/proxy?url=${encodeURIComponent(p1)}"`;
            });
            
            // 슬래시(/)로 시작하는 내부 상대 링크 치환
            html = html.replace(/href="\/([^\/][^"]*)"/g, (match, p1) => {
                const fullLink = `${baseUrl}/${p1}`;
                return `href="/api/proxy?url=${encodeURIComponent(fullLink)}"`;
            });

            // 지연 로딩 이미지 및 보안 정책 제거
            html = html.replace(/data-thumb="/g, 'src="');
            html = html.replace(/data-src="/g, 'src="');
            html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

        } catch (e) {
            console.error('주소 변환 오류:', e.message);
        }

        res.send(html);
    } catch (error) {
        console.error('프록시 에러:', error.message);
        res.status(500).send(`사이트 로드 실패: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`서버 가동 중 - 포트: ${PORT}`);
});