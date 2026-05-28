const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');

let uploadedCount = 0;
const MAX_POSTS = 5;

// [프로세스 1 & 2] books.toscrape.com 실제 크롤링 및 마크다운 변환 함수
async function crawlAndBuildMarkdown() {
    if (uploadedCount >= MAX_POSTS) {
        console.log("🎉 [미션 완료] 5개의 책 정보가 모두 5분 간격으로 수집 및 업로드되었습니다!");
        if (global.job) global.job.cancel();
        process.exit(0);
    }

    try {
        console.log(`🔍 [${uploadedCount + 1}/${MAX_POSTS}] books.toscrape.com에서 도서 데이터 수집 중...`);
        
        const targetUrl = 'https://books.toscrape.com/';
        const { data } = await axios.get(targetUrl);
        const $ = cheerio.load(data);
        
        // 사이트 내의 모든 책 아이템 목록 가져오기 (.product_pod 클래스)
        const books = $('.product_pod');
        
        // 스케줄링 순서(0번째~4번째)에 맞춰 한 번에 한 권의 책만 선택
        const targetBook = books.eq(uploadedCount);
        
        // 상세 데이터 추출 (제목, 가격, 링크 등)
        const title = targetBook.find('h3 a').attr('title'); // <a> 태그의 title 속성에 전체 제목이 들어있습니다.
        const price = targetBook.find('.price_color').text();
        const relativeLink = targetBook.find('h3 a').attr('href');
        const bookUrl = `https://books.toscrape.com/${relativeLink}`;

        // Hugo 양식에 맞춘 파일명 및 마크다운 설계
        const now = new Date();
        const fileDate = now.toISOString().split('T')[0];
        const fileName = `${fileDate}-scraped-book-${uploadedCount + 1}.md`;
        
        // 본인의 블로그 글 저장 경로에 맞춤 (content/posts/)
        const filePath = path.join(__dirname, 'content', 'posts', fileName);

        // Hugo Front Matter 헤더 양식에 맞춘 내용 조립
        const markdownContent = `---
title: "[도서 수집] ${title}"
date: ${now.toISOString()}
draft: false
tags: ["BooksToScrape", "자동크롤링"]
---

# 📖 해외 도서 실시간 수집 정보

## 📌 도서 상세
- **도서 제목:** ${title}
- **도서 가격:** ${price}
- **원문 링크:** [보러가기](${bookUrl})

---
*본 포스팅은 책 정보 수집 미션 조건에 의거하여, Node.js 스케줄러가 5분마다 자동으로 크롤링하여 push한 마크다운 파일입니다.*
`;

        // 1. 내 컴퓨터 폴더에 .md 파일로 저장
        fs.writeFileSync(filePath, markdownContent, 'utf-8');
        console.log(`📝 [1단계 완료] 마크다운 변환 완료: ${fileName}`);
        
        // 2. 깃허브 자동 배포 프로세스 가동 (Git Automation)
        runGitPush(title);

    } catch (error) {
        console.error(`❌ 크롤링 도중 오류가 발생했습니다:`, error.message);
    }
}

// [프로세스 3] Git Push 명령어 자동화 (Bash 스크립트 대행)
function runGitPush(bookTitle) {
    try {
        console.log("🚀 [2단계] Git Push 작업 진행 중...");
        execSync('git add .');
        execSync(`git commit -m "Feat: [자동화 봇] ${bookTitle} 등록 (${uploadedCount + 1}/${MAX_POSTS})"`);
        execSync('git push origin main');
        
        uploadedCount++;
        console.log(`✅ 깃허브 블로그 반영 성공! 현재 진행도: (${uploadedCount}/${MAX_POSTS})\n`);
    } catch (error) {
        console.error("❌ Git 실행 중 에러가 발생했습니다 (저장소 권한 및 상태 확인 요망):", error.message);
    }
}

// [프로세스 4] 순차적 스케줄러 세팅 (5분에 한 개씩)
console.log("🤖 [시스템 시작] books.toscrape.com 크롤러 봇 가동.");
console.log("⏱️ 조건: 5분에 한 개씩 자동으로 수집 및 마크다운 파일 변환 후 업로드합니다.\n");

// 1번째 책은 켜자마자 즉시 수집 및 업로드 진행
crawlAndBuildMarkdown();

// 2번째 책부터는 5분 간격으로 순차적 크롤링 스케줄링 실행
global.job = schedule.scheduleJob('*/5 * * * *', crawlAndBuildMarkdown);