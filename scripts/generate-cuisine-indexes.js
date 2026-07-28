/**
 * 菜系分类索引生成脚本
 * 从完整的 index.json 提取按菜系分类的小索引文件
 *
 * 使用方式：
 * node scripts/generate-cuisine-indexes.js
 *
 * 生成文件：
 * - sichuan_index.json (川菜)
 * - guangdong_index.json (粤菜)
 * - hunan_index.json (湘菜)
 * - shandong_index.json (鲁菜)
 * - zhejiang_index.json (江浙菜)
 * - dongbei_index.json (东北菜)
 * - jiachang_index.json (家常菜)
 * - kuaishou_index.json (快手菜)
 * - vegetarian_index.json (素食)
 */

const fs = require("fs");
const path = require("path");

// 菜系关键词映射
const CUISINE_KEYWORDS = {
  sichuan_index: [
    "川菜",
    "四川",
    "麻辣",
    "水煮",
    "回锅",
    "宫保",
    "鱼香",
    "麻婆",
    "夫妻肺片",
    "担担面",
    "龙抄手",
    "钟水饺",
    "赖汤圆",
    "串串香",
    "冒菜",
    "冷锅",
    "干锅",
    "火锅",
    "酸菜鱼",
    "毛血旺",
    "辣子鸡",
    "口水鸡",
    "棒棒鸡",
    "蒜泥白肉",
    "东坡肘子",
    "开水白菜",
    "樟茶鸭",
    "陈皮牛肉",
  ],
  guangdong_index: [
    "粤菜",
    "广东",
    "潮汕",
    "客家",
    "白切鸡",
    "烧鹅",
    "叉烧",
    "煲仔饭",
    "肠粉",
    "虾饺",
    "烧麦",
    "叉烧包",
    "蛋挞",
    "双皮奶",
    "姜撞奶",
    "老火靓汤",
    "清蒸",
    "白灼",
    "盐焗",
    "蜜汁",
    "咕噜肉",
    "糖醋",
    "脆皮",
    "干炒牛河",
    "艇仔粥",
    "及第粥",
    "潮汕牛肉",
    "牛肉丸",
    "卤水",
  ],
  hunan_index: [
    "湘菜",
    "湖南",
    "剁椒",
    "小炒",
    "农家",
    "毛氏红烧肉",
    "剁椒鱼头",
    "口味虾",
    "口味蟹",
    "臭豆腐",
    "糖油粑粑",
    "刮凉粉",
    "湖南米粉",
    "腊味",
    "烟熏",
    "干锅",
    "铁板",
  ],
  shandong_index: [
    "鲁菜",
    "山东",
    "济南",
    "胶东",
    "糖醋鲤鱼",
    "九转大肠",
    "爆炒腰花",
    "葱烧海参",
    "油焖大虾",
    "拔丝",
    "拔丝地瓜",
    "拔丝苹果",
    "锅塌",
    "糟溜",
    "油爆",
    "清蒸",
    "红烧",
    "酱爆",
    "木须肉",
    "四喜丸子",
  ],
  zhejiang_index: [
    "江浙菜",
    "浙江",
    "杭州",
    "宁波",
    "上海",
    "苏帮菜",
    "东坡肉",
    "西湖醋鱼",
    "龙井虾仁",
    "叫化鸡",
    "宋嫂鱼羹",
    "片儿川",
    "猫耳朵",
    "知味观",
    "小笼包",
    "生煎",
    "蟹壳黄",
    "油墩子",
    "腌笃鲜",
    "红烧肉",
    "糖醋小排",
    "油爆虾",
    "八宝鸭",
  ],
  dongbei_index: [
    "东北菜",
    "东北",
    "哈尔滨",
    "锅包肉",
    "地三鲜",
    "杀猪菜",
    "酸菜白肉",
    "小鸡炖蘑菇",
    "猪肉炖粉条",
    "铁锅炖",
    "拉皮",
    "拍黄瓜",
    "大拉皮",
    "东北乱炖",
    "尖椒干豆腐",
    "溜肉段",
    "焦熘肉段",
    "酱骨架",
    "得莫利炖鱼",
    "哈尔滨红肠",
    "烤冷面",
    "粘豆包",
  ],
  jiachang_index: [
    "家常菜",
    "家常",
    "番茄炒蛋",
    "青椒肉丝",
    "土豆丝",
    "酸辣土豆丝",
    "醋溜土豆丝",
    "红烧茄子",
    "干煸豆角",
    "蒜蓉",
    "清炒",
    "素炒",
    "炒青菜",
    "炒时蔬",
    "麻婆豆腐",
    "家常豆腐",
    "鱼香茄子",
    "地三鲜",
    "木须肉",
    "宫保鸡丁",
    "辣子鸡",
    "回锅肉",
    "水煮肉片",
    "水煮鱼",
    "酸菜鱼",
  ],
  kuaishou_index: [
    "快手菜",
    "快手",
    "懒人",
    "简单",
    "方便",
    "速炒",
    "快炒",
    "爆炒",
    "凉拌",
    "清炒",
    "蒜蓉",
    "白灼",
    "蒸蛋",
    "煮面",
    "炒饭",
    "盖浇饭",
    "拌面",
    "炒面",
    "蛋炒饭",
    "扬州炒饭",
  ],
  vegetarian_index: [
    "素食",
    "素菜",
    "素",
    "斋菜",
    "豆腐",
    "菌菇",
    "蘑菇",
    "香菇",
    "金针菇",
    "杏鲍菇",
    "木耳",
    "银耳",
    "蔬菜",
    "青菜",
    "白菜",
    "菠菜",
    "生菜",
    "油麦菜",
    "西兰花",
    "花菜",
    "茄子",
    "土豆",
    "番茄",
    "黄瓜",
    "冬瓜",
    "南瓜",
    "丝瓜",
    "苦瓜",
    "豆角",
    "四季豆",
    "玉米",
    "红薯",
    "山药",
    "莲藕",
  ],
};

// 读取完整的索引文件
function readFullIndex(indexPath) {
  console.log(`读取索引文件: ${indexPath}`);
  const content = fs.readFileSync(indexPath, "utf-8");
  const entries = JSON.parse(content);
  console.log(`索引总条目: ${entries.length}`);
  return entries;
}

// 根据关键词筛选菜谱
function filterByKeywords(entries, keywords) {
  const matched = new Set();
  const results = [];

  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    for (const keyword of keywords) {
      if (name.includes(keyword.toLowerCase())) {
        if (!matched.has(entry.name)) {
          matched.add(entry.name);
          results.push(entry);
        }
        break;
      }
    }
  }

  return results;
}

// 生成分类索引文件
function generateCuisineIndexes(indexPath, outputDir) {
  // 读取完整索引
  const allEntries = readFullIndex(indexPath);

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 为每个菜系生成索引
  for (const [filename, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    const matched = filterByKeywords(allEntries, keywords);
    const outputPath = path.join(outputDir, `${filename}.json`);

    fs.writeFileSync(outputPath, JSON.stringify(matched, null, 2));
    console.log(`生成 ${filename}.json: ${matched.length} 条`);
  }

  // 生成统计信息
  const stats = {
    total: allEntries.length,
    byCuisine: {},
  };
  for (const [filename, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    const matched = filterByKeywords(allEntries, keywords);
    stats.byCuisine[filename] = matched.length;
  }

  const statsPath = path.join(outputDir, "cuisine_stats.json");
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`\n统计信息已保存到: ${statsPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

// 主函数
function main() {
  const indexPath = process.argv[2] || "./data/index.json";
  const outputDir = process.argv[3] || "./data/cuisine_indexes";

  if (!fs.existsSync(indexPath)) {
    console.error(`索引文件不存在: ${indexPath}`);
    console.log("使用方式: node generate-cuisine-indexes.js <index.json路径> [输出目录]");
    process.exit(1);
  }

  console.log("开始生成菜系分类索引...");
  console.log(`输入: ${indexPath}`);
  console.log(`输出: ${outputDir}\n`);

  generateCuisineIndexes(indexPath, outputDir);

  console.log("\n✅ 完成！");
  console.log("\n下一步：");
  console.log("1. 将生成的 *_index.json 文件上传到 R2 存储");
  console.log("2. 使用命令: npx wrangler r2 object put xiachufangdata/sichuan_index.json --file=./data/cuisine_indexes/sichuan_index.json");
}

main();
