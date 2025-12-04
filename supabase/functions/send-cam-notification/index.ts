import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
    camId: string;
    action: 'submitted' | 'approved' | 'rejected' | 'correction_pending';
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { camId, action }: NotificationRequest = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Fetch CAM details
        const { data: cam, error: camError } = await supabase
            .from('cam_tracking')
            .select('*')
            .eq('id', camId)
            .single();

        if (camError || !cam) {
            throw new Error(`CAM record not found: ${camError?.message}`);
        }

        // Fetch Uploader Profile
        const { data: uploader } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', cam.uploaded_by)
            .single();

        // Fetch Approver Profile (if exists)
        let approver = null;
        if (cam.approved_by) {
            const { data: approverData } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', cam.approved_by)
                .single();
            approver = approverData;
        }

        const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'http://localhost:5173';

        const monthName = cam.month ? new Date(cam.year, cam.month - 1).toLocaleString('default', { month: 'long' }) : '';
        const period = cam.month ? `${monthName} ${cam.year}` : `Q${cam.quarter} ${cam.year}`;

        if (action === 'submitted') {
            // Notify Treasurers
            const { data: treasurers, error: treasurerError } = await supabase
                .from('user_roles')
                .select('user_id, profiles!user_roles_user_id_fkey (full_name, email)')
                .eq('role', 'treasurer');

            if (treasurerError || !treasurers || treasurers.length === 0) {
                throw new Error('No treasurers found to notify');
            }

            for (const treasurer of treasurers) {
                const treasurerProfile = treasurer.profiles as any;
                const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; font-size: 24px; text-align: center;">New CAM Data Submitted</h1>
            <p>Hi ${treasurerProfile.full_name || 'Treasurer'},</p>
            <p>New CAM data for <strong>Tower ${cam.tower}</strong> (${period}) has been submitted by ${uploader?.full_name || 'Lead'}.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p><strong>Paid Flats:</strong> ${cam.paid_flats}</p>
              <p><strong>Pending Flats:</strong> ${cam.pending_flats}</p>
              <p><strong>Total Flats:</strong> ${cam.total_flats}</p>
            </div>

            <a href="${appUrl}/approvals" style="background: #2563eb; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
              Review & Approve
            </a>
          </div>
        `;

                await resend.emails.send({
                    from: 'CAM Tracker <onboarding@resend.dev>',
                    to: [treasurerProfile.email],
                    subject: `New CAM Submission: Tower ${cam.tower} - ${period}`,
                    html: emailContent,
                });
            }
        } else if (action === 'approved') {
            // Notify Uploader
            const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #16a34a; font-size: 24px; text-align: center;">CAM Data Approved</h1>
          <p>Hi ${uploader?.full_name || 'User'},</p>
          <p>Your CAM submission for <strong>Tower ${cam.tower}</strong> (${period}) has been approved by ${approver?.full_name || 'Treasurer'}.</p>
          
          <a href="${appUrl}/cam-tracking" style="background: #16a34a; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
            View Dashboard
          </a>
        </div>
      `;

            await resend.emails.send({
                from: 'CAM Tracker <onboarding@resend.dev>',
                to: [uploader?.email],
                subject: `CAM Approved: Tower ${cam.tower} - ${period}`,
                html: emailContent,
            });
        } else if (action === 'rejected' || action === 'correction_pending') {
            // Notify Uploader
            const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626; font-size: 24px; text-align: center;">CAM Data Returned</h1>
          <p>Hi ${uploader?.full_name || 'User'},</p>
          <p>Your CAM submission for <strong>Tower ${cam.tower}</strong> (${period}) has been returned for correction.</p>
          
          <a href="${appUrl}/cam-tracking" style="background: #dc2626; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
            View & Edit
          </a>
        </div>
      `;

            await resend.emails.send({
                from: 'CAM Tracker <onboarding@resend.dev>',
                to: [uploader?.email],
                subject: `CAM Returned: Tower ${cam.tower} - ${period}`,
                html: emailContent,
            });
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
