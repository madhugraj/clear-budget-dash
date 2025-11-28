import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  incomeId: string;
  action: 'created' | 'updated';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { incomeId, action }: NotificationRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch income details with category information
    // Note: recorded_by relationship might be missing in schema, so we fetch profile separately
    const { data: income, error: incomeError } = await supabase
      .from('income_actuals')
      .select(`
        *,
        category:income_categories!income_actuals_category_id_fkey(category_name, subcategory_name)
      `)
      .eq('id', incomeId)
      .single();

    if (incomeError || !income) {
      console.error('Error fetching income:', incomeError);
      throw new Error('Failed to fetch income details');
    }

    // Fetch recorder profile
    let recorderProfile = null;
    if (income.recorded_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', income.recorded_by)
        .single();
      recorderProfile = profile;
    }

    // Fetch all treasurers
    const { data: treasurerRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, profiles(email, full_name)')
      .eq('role', 'treasurer');

    if (rolesError || !treasurerRoles) {
      throw new Error('Failed to fetch treasurer roles');
    }

    const treasurerEmails = treasurerRoles
      .map((role: any) => role.profiles?.email)
      .filter((email: string | undefined) => email);

    if (treasurerEmails.length === 0) {
      console.log('No treasurer emails found');
      return new Response(
        JSON.stringify({ message: 'No treasurers to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format category name
    const categoryName = income.category.subcategory_name
      ? `${income.category.category_name} - ${income.category.subcategory_name}`
      : income.category.category_name;

    // Format month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[income.month - 1];

    // Format amounts
    const baseAmount = parseFloat(income.actual_amount).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });
    const gstAmount = parseFloat(income.gst_amount).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });
    const totalAmount = (parseFloat(income.actual_amount) + parseFloat(income.gst_amount)).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });

    const actionText = action === 'created' ? 'added' : 'updated';
    const recorderName = recorderProfile?.full_name || recorderProfile?.email || 'An accountant';

    // Compose email
    const emailSubject = `Income Record ${action === 'created' ? 'Added' : 'Updated'} - ${categoryName}`;
    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
              Income Record ${action === 'created' ? 'Added' : 'Updated'}
            </h2>
            
            <p>Hello,</p>
            
            <p><strong>${recorderName}</strong> has ${actionText} an income record:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Category:</strong></td>
                  <td style="padding: 8px 0;">${categoryName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Month:</strong></td>
                  <td style="padding: 8px 0;">${monthName} ${income.fiscal_year}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Base Amount:</strong></td>
                  <td style="padding: 8px 0;">${baseAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>GST Amount:</strong></td>
                  <td style="padding: 8px 0;">${gstAmount}</td>
                </tr>
                <tr style="border-top: 2px solid #d1d5db;">
                  <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
                  <td style="padding: 8px 0; font-size: 18px; color: #059669;"><strong>${totalAmount}</strong></td>
                </tr>
                ${income.notes ? `
                <tr>
                  <td style="padding: 8px 0; vertical-align: top;"><strong>Notes:</strong></td>
                  <td style="padding: 8px 0;">${income.notes}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              This is an automated notification from your income tracking system.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send emails to all treasurers
    const emailPromises = treasurerEmails.map((email: string) =>
      resend.emails.send({
        from: 'Income Tracker <onboarding@resend.dev>',
        to: [email],
        subject: emailSubject,
        html: emailHtml,
      })
    );

    await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({ message: 'Notifications sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending income notification:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
