const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase 配置（第二套系统独立数据库）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uwjwlgqexmzyfblwmbuo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3andsZ3FleG16eWZibHdtYnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzMwNDksImV4cCI6MjA5MzY0OTA0OX0.j0za_7PB4uvS7WQPUoCypaFDYnfu74dvG053NOzMbYc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Resend 邮件配置
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_4J4d9T2Q_6QPUSUUegaUSTUX6Wtrzskgu';
const resend = new Resend(RESEND_API_KEY);

// 通知邮箱
const NOTIFICATION_EMAIL = 'victoriazhang696@gmail.com';

// 管理员账号密码
const ADMIN_USERNAME = '90048253';
const ADMIN_PASSWORD = '362681';

// 密钥用于生成 token
const SECRET_KEY = process.env.SECRET_KEY || 'ai-lobster-secret-key-2026';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 生成 token
function generateToken() {
    return crypto.createHash('sha256').update(`${ADMIN_USERNAME}${Date.now()}${SECRET_KEY}`).digest('hex');
}

// 验证 token
function verifyToken(token) {
    return token && token.length === 64;
}

// 发送邮件通知
async function sendNotification(data) {
    try {
        const { phone, email, notes, timestamp } = data;
        
        const submitTime = new Date(timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        await resend.emails.send({
            from: 'AI龙虾预约系统 <onboarding@resend.dev>',
            to: NOTIFICATION_EMAIL,
            subject: '🦞 新的预约通知 - AI龙虾系统',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0fdf4;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                        <h1 style="margin: 0;">🦞 新的预约通知</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">AI龙虾预约系统</p>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px;">
                        <p style="font-size: 16px; color: #1f2937; margin-bottom: 20px;">您收到一条新的预约信息：</p>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 120px;">提交时间</td>
                                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${submitTime}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">电话/WhatsApp</td>
                                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${phone || '未填写'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">邮箱</td>
                                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${email || '未填写'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #6b7280; vertical-align: top;">备注</td>
                                <td style="padding: 12px 0; color: #1f2937;">${notes || '未填写'}</td>
                            </tr>
                        </table>
                        
                        <div style="margin-top: 30px; text-align: center;">
                            <a href="https://ai-lobster-v2.onrender.com/login.html" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 10px; font-weight: bold;">登录后台查看</a>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
                        © 2026 AI龙虾智能养殖 | Homily Chart Malaysia
                    </div>
                </div>
            `
        });
        
        console.log('邮件通知发送成功');
    } catch (error) {
        console.error('邮件发送失败:', error);
    }
}

// API: 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateToken();
        res.json({ success: true, token });
    } else {
        res.json({ success: false, message: '用户名或密码错误' });
    }
});

// API: 提交预约
app.post('/api/submit', async (req, res) => {
    const { phone, email, notes, timestamp } = req.body;

    // 验证至少有一项联系方式
    if (!phone && !email) {
        return res.json({ success: false, message: '请至少填写一项联系方式' });
    }

    try {
        // 保存数据到 Supabase
        const { data, error } = await supabase
            .from('reservations')
            .insert([
                {
                    phone: phone || '',
                    email: email || '',
                    notes: notes || '',
                    timestamp: timestamp || new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Supabase error:', error);
            return res.json({ success: false, message: '提交失败，请稍后重试' });
        }

        // 发送邮件通知（异步执行，不阻塞响应）
        sendNotification({
            phone: phone || '',
            email: email || '',
            notes: notes || '',
            timestamp: timestamp || new Date().toISOString()
        });

        res.json({ success: true, message: '预约成功' });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, message: '网络错误，请稍后重试' });
    }
});

// API: 获取预约列表（需要登录）
app.get('/api/reservations', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!verifyToken(token)) {
        return res.status(401).json({ success: false, message: '未授权' });
    }

    try {
        // 从 Supabase 获取数据
        const { data, error } = await supabase
            .from('reservations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            return res.json({ success: false, message: '获取数据失败' });
        }

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, message: '网络错误' });
    }
});

// 后台管理页面路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 登录页面路由
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
