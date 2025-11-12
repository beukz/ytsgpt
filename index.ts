// supabase/functions/generate-comment/index.ts
// Note: You can rename this file to 'index.ts' and place it in the 'supabase/functions/generate-comment/' directory.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.52.7/mod.ts';

// CORS headers for browser interaction
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize OpenAI client using environment variables
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      email, 
      tone, 
      comment: comment_text,
      videoTitle,
      videoDescription,
      appendMessageEnabled,
      appendMessageText
    } = await req.json();

    if (!email || !tone || !comment_text) {
      return new Response(JSON.stringify({ success: false, message: "Missing email, tone, or comment text." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create a Supabase client with the service role key for admin-level access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Check if the user exists and has sufficient credits
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('credits')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Your email was not found in our database." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const userCredits = user.credits;
    // -1 means unlimited credits. Otherwise, they must have credits > 0.
    if (userCredits !== -1 && userCredits <= 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "Insufficient credits, please top-up your account. New credits will be added to your account at the beginning of each month."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402, // Payment Required
      });
    }

    // 2. Call OpenAI API to generate the comment
    let generated_comment = '';

    // Construct the prompt with optional video context
    let promptContent = `Generate a human-like reply in a ${tone} tone for this YouTube comment: ${comment_text}, keep it medium to short and response in the same language as the comment [no additional text, like this is the response ect..]`;

    if (videoTitle) {
      let contextString = `\nThe comment is on a video titled "${videoTitle}".`;
      if (videoDescription) {
        // Limit description length to avoid overly long prompts
        const truncatedDescription = videoDescription.substring(0, 500);
        contextString += ` The video description is: "${truncatedDescription}".`;
      }
      contextString += ` Use this context to make the reply more relevant if possible.`;
      promptContent += contextString;
    }

    try {
      const chatCompletion = await openai.chat.completions.create({
        messages: [{
          role: "user",
          content: promptContent,
        }],
        model: "gpt-5-mini-2025-08-07",
      });

      if (chatCompletion.choices && chatCompletion.choices.length > 0 && chatCompletion.choices[0].message.content) {
        generated_comment = chatCompletion.choices[0].message.content;
      } else {
        throw new Error("No choices were returned from the OpenAI API.");
      }
    } catch (apiError) {
      console.error('Error during OpenAI API call:', apiError);
      return new Response(JSON.stringify({ success: false, message: "Failed to generate comment. Please try again or contact support." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Append custom message if enabled
    if (appendMessageEnabled && appendMessageText && appendMessageText.trim() !== '') {
      generated_comment += `\n\n${appendMessageText}`;
    }

    // 3. Deduct one credit if the user is not on an unlimited plan
    let remaining_credits = userCredits;
    if (userCredits !== -1) {
      const { data: updatedUserData, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ credits: userCredits - 1 })
        .eq('email', email)
        .select('credits')
        .single();

      if (updateError) {
        console.error('Error deducting credit:', updateError);
        // If updating credits fails, return an error as we couldn't complete the transaction.
        return new Response(JSON.stringify({ success: false, message: "Failed to update credits after generation." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      remaining_credits = updatedUserData.credits;
    }

    // 4. Return success response
    return new Response(JSON.stringify({
      success: true,
      generated_comment: generated_comment,
      remaining_credits: remaining_credits,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return new Response(JSON.stringify({ success: false, message: 'An unexpected server error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})