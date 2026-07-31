import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/cloudflare';
import { getAuthFromRequest } from '@/lib/auth';

// 获取用户摇摇乐记录和统计
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    
    const env = await getEnv();
    const db = env.DB;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'records';
    
    if (type === 'broadcast') {
      // 获取全服最新播报（匿名化，不需要登录）
      const records = await db.prepare(`
        SELECT 
          result_type,
          bet_amount,
          win_amount,
          created_at
        FROM lotto_records 
        WHERE win_amount > 0
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();
      
      return NextResponse.json(records.results || []);
    }
    
    // 以下接口需要登录
    if (!auth?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    if (type === 'stats') {
      // 获取统计数据
      const stats = await db.prepare(`
        SELECT 
          COUNT(*) as total_spins,
          COALESCE(SUM(bet_amount), 0) as total_bet,
          COALESCE(SUM(win_amount), 0) as total_win,
          COALESCE(MAX(win_amount), 0) as max_win
        FROM lotto_records 
        WHERE user_id = ?
      `).bind(auth.userId).first();
      
      return NextResponse.json(stats || { total_spins: 0, total_bet: 0, total_win: 0, max_win: 0 });
    }
    
    // 获取用户记录
    const records = await db.prepare(`
      SELECT 
        id,
        result_type,
        bet_amount,
        win_amount,
        recipe_name,
        created_at
      FROM lotto_records 
      WHERE user_id = ?
      ORDER BY created_at DESC 
      LIMIT 50
    `).bind(auth.userId).all();
    
    return NextResponse.json(records.results || []);
    
  } catch (error) {
    console.error('Lottery API error:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}

// 保存摇摇乐记录
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { resultType, betAmount, winAmount, recipeName } = body;
    
    if (!resultType || !betAmount || !recipeName) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const env = await getEnv();
    const db = env.DB;
    
    await db.prepare(`
      INSERT INTO lotto_records (user_id, result_type, bet_amount, win_amount, recipe_name)
      VALUES (?, ?, ?, ?, ?)
    `).bind(auth.userId, resultType, betAmount, winAmount || 0, recipeName).run();
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Save lottery record error:', error);
    return NextResponse.json({ error: '保存记录失败' }, { status: 500 });
  }
}
