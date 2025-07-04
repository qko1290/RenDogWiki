import { NextRequest, NextResponse } from "next/server";
import { db } from "@/wiki/lib/db";
import { S3 } from "aws-sdk";

export const runtime = "nodejs"; // 반드시 nodejs로, edge에서는 파일 업로드 안 됨

// S3 인스턴스 (aws-sdk는 node에서만)
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

export async function POST(req: NextRequest) {
  // formData 파싱
  const formData = await req.formData();
  const files = formData.getAll("files");
  const folderId = formData.get("folder_id");
  const uploader = "admin"; // 추후 인증 연결 시 수정

  if (!folderId) {
    return NextResponse.json({ error: "폴더 ID 누락" }, { status: 400 });
  }

  if (!files.length) {
    return NextResponse.json({ error: "파일 없음" }, { status: 400 });
  }

  const uploaded = [];

  for (const file of files) {
    if (
      typeof file === "string" ||
      !(file instanceof File)
    ) continue;

    // 파일 buffer 추출
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() ?? "";
    const key = `images/${folderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // S3 업로드
    let s3result;
    try {
      s3result = await s3.upload({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }).promise();
    } catch (e: any) {
      return NextResponse.json({ error: "S3 업로드 실패: " + e.message }, { status: 500 });
    }

    // DB 저장
    let dbResult;
    try {
      dbResult = await db.query(
        `INSERT INTO images (name, folder_id, uploader, s3_key, url, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [file.name, folderId, uploader, key, s3result.Location, file.type]
      );
    } catch (e: any) {
      return NextResponse.json({ error: "DB 저장 실패: " + e.message }, { status: 500 });
    }

    uploaded.push(dbResult.rows[0]);
  }

  return NextResponse.json({ images: uploaded });
}
