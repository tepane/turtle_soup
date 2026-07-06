# 바다거북수프 아카이브

GitHub Pages에 올릴 수 있는 정적 웹사이트입니다. 방문자는 로그인 없이 문제와 정답을 볼 수 있고, 관리자만 문제 추가/수정/삭제 및 별점 편집을 할 수 있습니다.

## 포함 기능

- 문제 목록 표시
- 제목/제시문/정답 저장
- 난이도 별점 1~5
- 창의성 별점 1~5
- 정답 보기/숨기기
- 검색
- 정렬
- 관리자 로그인
- 관리자 전용 문제 추가/수정/삭제
- Firebase 미설정 시 localStorage 데모 모드

## 파일 구조

```txt
index.html
styles.css
app.js
firebase-config.js
firestore.rules
.nojekyll
README.md
```

## 1. Firebase 프로젝트 만들기

1. Firebase Console에서 프로젝트를 만듭니다.
2. Authentication > Sign-in method에서 Email/Password를 활성화합니다.
3. Authentication > Users에서 관리자 이메일/비밀번호 계정을 하나 만듭니다.
4. Firestore Database를 만듭니다.
5. Project settings > General > Your apps에서 Web app을 추가하고 Firebase config 값을 복사합니다.

## 2. 관리자 UID 확인

Firebase Console > Authentication > Users에서 관리자 계정의 UID를 복사합니다.

## 3. firebase-config.js 수정

`firebase-config.js`의 값을 실제 Firebase 설정으로 교체합니다.

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

export const adminUids = ["관리자_UID"];
```

## 4. Firestore 보안 규칙 수정

`firestore.rules`의 `YOUR_ADMIN_UID`를 실제 관리자 UID로 바꾼 뒤 Firebase Console > Firestore Database > Rules에 붙여넣고 Publish 합니다.

```txt
request.auth.uid in ["관리자_UID"]
```

이 규칙 때문에 사이트 소스가 공개되어도 일반 방문자는 문제를 수정할 수 없습니다.

## 5. GitHub Pages 배포

1. 이 폴더의 파일들을 GitHub 저장소에 올립니다.
2. GitHub 저장소 Settings > Pages로 이동합니다.
3. Source를 `Deploy from a branch`로 선택합니다.
4. Branch를 `main`, folder를 `/root`로 선택합니다.
5. 저장하면 Pages 주소가 생성됩니다.

## 주의

Firebase config는 비밀키가 아닙니다. 실제 보안은 Firestore Security Rules가 담당합니다. 따라서 `firestore.rules`를 정확히 설정하지 않으면 관리자 보호가 깨집니다.

## 데모 모드

`firebase-config.js`가 기본값 그대로이면 사이트는 localStorage 데모 모드로 실행됩니다. 이 모드는 브라우저 안에서만 저장되므로 실제 운영용이 아닙니다.
