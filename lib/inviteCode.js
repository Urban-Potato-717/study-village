// Object: 6자리 코드를 랜덤 생성하되, rooms.invite_code에 이미 있는 코드면 다시 뽑기 -> 유일한 코드 반환.
var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';// 0,1,O,I 햇갈려서 제외

async function generateUniqueInviteCode(pool) {
    // 1) code 하나 조립
    // 밖 루프는 10번으로 혹시 모를 에러 대비
    for(var tries = 0; tries < 10; tries++){   
        var code='';
        for(var i=0; i<6; i++){
            var idx = Math.floor(Math.random()*CHARS.length);
            code += CHARS.charAt(idx); // 생성된 랜덤 문자 하나 (idx)를 code 변수에 이어붙임
        } 
        // 2) rooms가 UNIQUE한지 검증 - result await
        var [rows] = await pool.query( // pool.query는 DB에 SQL문, rooms 테이블에 조회 요청을 내는 것
            'SELECT id FROM rooms WHERE invite_code = ?',
            [code]
        );
        // 3) 없으면 (중복 아님) - 여기로
        if (rows.length === 0){
            return code; //겹치지 않으면, code를 return해주고 함수를 통째로 끝냄.
        }
    }
    throw new Error('초대코드 생성 실패(재시도 횟수 초과)');
}

module.exports = {generateUniqueInviteCode: generateUniqueInviteCode};
