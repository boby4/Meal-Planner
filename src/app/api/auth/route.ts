import { NextRequest, NextResponse } from "next/server";
import { registerUser, loginUser, verifyToken, logoutUser, mergeDeviceData, getAuthFromRequest } from "@/lib/auth";

/** POST /api/auth - 登录/注册统一入口 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, device_id } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    let result;

    if (action === "register") {
      result = await registerUser(email, password);
    } else {
      result = await loginUser(email, password);
    }

    // 登录/注册成功后，合并设备数据
    if (device_id) {
      await mergeDeviceData(result.user.id, device_id);
    }

    return NextResponse.json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** GET /api/auth - 获取当前用户信息 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthFromRequest(request);

    if (!userId) {
      return NextResponse.json({ user: null });
    }

    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const user = await verifyToken(token);

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}

/** DELETE /api/auth - 退出登录 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (token) {
      await logoutUser(token);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/auth 错误:", error);
    return NextResponse.json({ error: "退出失败" }, { status: 500 });
  }
}
