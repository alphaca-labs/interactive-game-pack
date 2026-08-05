# 에셋 출처

## 요약

**이 패키지에는 제3자 에셋이 없습니다.** 8종 전부 아트·사운드·폰트를 자체 제작했고, 실행 중 외부 도메인으로 나가는 요청이 0건입니다.

| 항목 | 방식 | 제3자 라이선스 |
|---|---|---|
| 아이콘 · 캐릭터 · 배경 | 인라인 SVG(`<svg>` 심볼) + CSS 도형·그라디언트 | 없음 (자체 제작) |
| 파티클 · 이펙트 | CSS 애니메이션, Canvas 2D 절차적 렌더 | 없음 (자체 제작) |
| 효과음 | Web Audio API 합성(OscillatorNode·GainNode) | 없음 (자체 제작) |
| 서체 | OS 시스템 폰트 스택(`system-ui`, `Apple SD Gothic Neo`, `Pretendard`, `Malgun Gothic`) | 웹폰트 미배포 |
| 카드 썸네일 (`assets/thumbs/*.jpg`) | 자체 데모를 헤드리스 Chrome으로 촬영 (`scripts/capture-thumbs.mjs`) | 없음 (자체 산출물) |

## 무료 에셋을 쓰지 않은 이유

CC0/OFL 계열 무료 에셋 사용을 검토했으나 채택하지 않았습니다.

- 8종의 아트 톤을 하나로 맞추려면 결국 대부분을 다시 그려야 했고, 절차적 SVG 쪽이 톤 통일과 수정 속도 모두 유리했습니다.
- 플레이어블 광고 배포에서는 용량이 곧 전환율입니다. 인라인 SVG는 비트맵 스프라이트보다 작고 해상도 독립적입니다.
- 광고 네트워크 심사에서 에셋 출처를 소명할 일이 없어집니다. 저장소 전체가 단일 저작권자 소유입니다.

## 계측 근거

```
node scripts/verify-pack.mjs
```

Chrome DevTools Protocol의 `Network.requestWillBeSent`로 모든 요청을 수집한 뒤, 로컬 origin·`data:`·`blob:`이 아닌 요청이 하나라도 있으면 실패 처리합니다. 허브와 8종 전부 외부 요청 0건으로 통과합니다.

## 레퍼런스 취급

레퍼런스 영상([YouTube `xQH4X57HKQo`](https://www.youtube.com/watch?v=xQH4X57HKQo))에서 가져온 것은 **인터랙션 메커니즘에 대한 판독 결과**뿐입니다. 원본의 로고·타이틀·캐릭터 디자인·UI 스크린샷·추출 스프라이트는 이 저장소에 포함되어 있지 않습니다.

판독 근거로 쓴 원본 프레임 캡처(`outputs/frames/`)는 **의도적으로 저장소에서 제외했습니다**(`.gitignore`). 제3자 영상의 프레임을 공개 저장소·공개 페이지로 재배포하지 않기 위해서입니다. 프레임은 작업 호스트에만 남아 있고, 각 프레임에서 무엇을 읽었는지는 [`outputs/research-brief.md`](outputs/research-brief.md)의 표에 글로 정리되어 있습니다. 배포되는 페이지(`index.html`과 `games/`)는 프레임을 참조하지 않습니다.
