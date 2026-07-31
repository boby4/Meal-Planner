import { NextRequest, NextResponse } from "next/server";
import { registerUser, loginUser, verifyToken, logoutUser, mergeDeviceData, updateUsername } from "@/lib/auth";
import { getEnv } from "@/lib/cloudflare";
import { POINT_RULES } from "@/app/api/points/route";

/** POST /api/auth - 登录/注册统一入口 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, username, device_id } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    let result;

    if (action === "register") {
      result = await registerUser(email, password, username);
      
      // 新用户注册赠送积分
      try {
        const env = await getEnv();
        if (env?.DB) {
          const rule = POINT_RULES.REGISTER;
          
          // 创建积分记录
          await env.DB
            .prepare("INSERT INTO user_points (user_id, points, total_earned, total_spent) VALUES (?, ?, ?, 0)")
            .bind(result.user.id, rule.points, rule.points)
            .run();
          
          // 记录积分变动
          await env.DB
            .prepare("INSERT INTO point_records (user_id, points, type, description) VALUES (?, ?, ?, ?)")
            .bind(result.user.id, rule.points, "REGISTER", rule.description)
            .run();
        }
      } catch (e) {
        console.error("新用户积分发放失败:", e);
      }
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
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // 只调用一次 verifyToken（内部已做 JOIN 查询）
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

/** PUT /api/auth - 修改用户名 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await getAuthFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
    }

    const result = await updateUsername(userId, username);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, username: username.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "修改失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
