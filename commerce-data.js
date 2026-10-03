// Team-provided procurement amounts, stored in cents to avoid rounding drift.
export const PROTOTYPE_BOM = [
  {name: 'ESP32-S3 N16R8 开发板', cents: 3740},
  {name: '5V20A / 100W 开关电源', cents: 2864},
  {name: 'PCA9685 16 路 PWM 舵机驱动板', cents: 2011},
  {name: 'MG90S 14g 金属齿轮 180° 舵机', cents: 10273},
  {name: 'INMP441 麦克风模块', cents: 457},
  {name: 'M3×8 螺丝螺母', cents: 1120},
  {name: 'PLA 3D 打印材料', cents: 4400},
  {name: '高透明亚克力板', cents: 1590}
];
export const PRODUCTS = {
  tone: {
    name: 'FLOW KEY Tone', stage: '产品规划｜约三柱语言声调学习版',
    position: '三根柱子的连续变化，共同表现一个字的音高走势。',
    users: '外国人学习普通话；普通话声调训练；未来适配粤语、民族语言与地方方言学习。',
    features: '约三根主要动态柱，表现平、扬、弯、降。计划比较实际与标准声调轨迹，指出偏高、偏低和走势差异。',
    business: '语言学习与发音训练的消费级硬件，也可探索教学配套。',
    boundary: '尚未完成实体产品。普通话四声示例不能直接套用其他语言；各语言的声调规则、模型、参照轨迹与识别效果需单独验证。'
  },
  mini: {
    name: 'FLOW KEY OLED Mini', stage: '产品规划｜桌面音乐学习版',
    position: '把核心音准反馈，带到个人练习与家庭桌面。',
    users: '音乐初学者、家庭音乐学习者与个人声乐练习者。',
    features: '更少柱体、更小尺寸、桌面化结构；保留音准反馈，探索降低硬件与制造成本。',
    business: '个人消费级产品。',
    boundary: '尚未完成实体产品。柱体数量、尺寸、成本与售价未确定；具体规格以用户需求与工程验证为准。'
  },
  edu: {
    name: 'FLOW KEY EDU', stage: '当前 15 柱原型的产品化方向',
    position: '把“再高一点、再低一点”，变成学生看得见的反馈。',
    users: '音乐初学者与音高理解需求人群；音乐教室、声乐培训、学校与教师。',
    features: '当前原型：十二音级反馈、教学模式、音准偏差可视化、本地 AI 与舵机实体反馈。后续探索 AI 半教跟随、趣味陪伴、亮珠交互与课程体系。',
    business: '面向学校、音乐教育机构与教师，探索硬件 + 教学软件 + 教学内容。',
    boundary: '当前成果为技术原型，尚非量产产品。FLOW KEY 辅助教师，把教学建议转化为可见反馈，不替代教师。'
  },
  space: {
    name: 'FLOW KEY SPACE', stage: '概念方向｜大型空间定制版',
    position: '让声音互动，从一张桌面扩展到一个空间。',
    users: '科技馆、艺术展览、品牌活动、音乐空间与商业空间。',
    features: '规划更大尺寸、多设备联动、音乐模式、声音互动、定制外观与空间级视觉反馈。',
    business: 'B 端项目合作、品牌定制与展览互动。',
    boundary: '尚未完成实体产品或合作订单。音乐模式、多设备联动与空间定制均为待开发方向。'
  }
};
// Illustrative contours only. Not trained tone models or measured pitch samples.
export const TONE_CONTOURS = [
  {label: '第一声 · 平：保持相对稳定的高位走势', name: '普通话第一声：平稳高位走势示意', points: [.82, .82, .82]},
  {label: '第二声 · 扬：从较低位置逐渐向上', name: '普通话第二声：上扬走势示意', points: [.25, .53, .86]},
  {label: '第三声 · 弯：先下降，再上升', name: '普通话第三声：单字完整先降后升走势示意', points: [.6, .15, .72]},
  {label: '第四声 · 降：从高位向低位变化', name: '普通话第四声：下降走势示意', points: [.9, .5, .12]}
];
