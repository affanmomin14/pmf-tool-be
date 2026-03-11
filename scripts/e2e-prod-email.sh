#!/usr/bin/env bash
# E2E on production: assessment → report (poll) → lead → send email → assert PDF attached.
# Usage: BASE_URL=https://kl5z1i0tdg.execute-api.ap-south-1.amazonaws.com ./scripts/e2e-prod-email.sh

set -e
API="${BASE_URL:-https://kl5z1i0tdg.execute-api.ap-south-1.amazonaws.com}"
EMAIL="${TEST_EMAIL:-affan.momin@wednesday.is}"

echo "=== PMF E2E (Production) — Report + Email + PDF ==="
echo "API:   $API"
echo "Email: $EMAIL"
echo ""

# 1. Create assessment
AID=$(curl -s -X POST "$API/api/assessments" -H "Content-Type: application/json" \
  -d '{"problemType":"market_fit"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "1. Assessment: $AID"

# 2. Submit 5 responses
for q in 1 2 3 4 5; do
  case $q in
    1) curl -s -X POST "$API/api/assessments/$AID/responses" -H "Content-Type: application/json" \
       -d '{"questionId":1,"answerText":"B2B sales CRM.","timeSpentMs":5000,"questionOrder":1}' > /dev/null ;;
    2) curl -s -X POST "$API/api/assessments/$AID/responses" -H "Content-Type: application/json" \
       -d '{"questionId":2,"answerText":"Sales reps.","timeSpentMs":4000,"questionOrder":2}' > /dev/null ;;
    3) curl -s -X POST "$API/api/assessments/$AID/responses" -H "Content-Type: application/json" \
       -d '{"questionId":3,"answerValue":"founder_led","timeSpentMs":3000,"questionOrder":3}' > /dev/null ;;
    4) curl -s -X POST "$API/api/assessments/$AID/responses" -H "Content-Type: application/json" \
       -d '{"questionId":4,"answerText":"Low connect rate.","timeSpentMs":4000,"questionOrder":4}' > /dev/null ;;
    5) curl -s -X POST "$API/api/assessments/$AID/responses" -H "Content-Type: application/json" \
       -d '{"questionId":5,"answerText":"40 customers.","timeSpentMs":6000,"questionOrder":5}' > /dev/null ;;
  esac
done
echo "2. Submitted 5 responses"

# 3. Complete (trigger async pipeline)
curl -s -X POST "$API/api/assessments/$AID/complete" -H "Content-Type: application/json" > /dev/null
echo "3. Pipeline triggered"

# 4. Poll until report_generated
echo "4. Polling for report..."
TOK=""
for i in $(seq 1 24); do
  sleep 5
  R=$(curl -s "$API/api/assessments/$AID")
  S=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
  TOK=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('reportToken','') or '')" 2>/dev/null)
  echo "   ${i}0s: $S"
  if [ "$S" = "report_generated" ] && [ -n "$TOK" ]; then
    echo "   Report token: $TOK"
    break
  fi
  if [ "$S" = "in_progress" ]; then
    E=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('pipelineErrorMessage','') or '')" 2>/dev/null)
    if [ -n "$E" ]; then
      echo "   Pipeline error: $E"
      exit 1
    fi
  fi
done
if [ -z "$TOK" ]; then
  echo "Timeout waiting for report"
  exit 1
fi

# 5. Submit lead (unlock)
echo "5. Submitting lead..."
LEAD=$(curl -s -w "\n%{http_code}" -X POST "$API/api/leads" -H "Content-Type: application/json" \
  -d "{\"assessmentId\":\"$AID\",\"email\":\"$EMAIL\"}")
CODE=$(echo "$LEAD" | tail -n1)
if [ "$CODE" != "200" ] && [ "$CODE" != "201" ]; then
  echo "Lead failed: HTTP $CODE"
  exit 1
fi
echo "   Lead OK"

# 6. Send report email and assert pdfAttached
echo "6. Sending report email..."
RESP=$(curl -s -X POST "$API/api/reports/$TOK/email" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
SENT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(d.get('sent', False))" 2>/dev/null)
PDF=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(d.get('pdfAttached', False))" 2>/dev/null)

echo "   sent: $SENT, pdfAttached: $PDF"
if [ "$SENT" != "True" ] && [ "$SENT" != "true" ]; then
  echo "Email send failed (sent=$SENT)"
  exit 1
fi
# After deploy with pdfAttached in response, require PDF attached
if [ "$PDF" != "True" ] && [ "$PDF" != "true" ]; then
  echo "PDF was not attached (pdfAttached=$PDF). Check Lambda logs for PDF generation or validation errors."
  exit 1
fi

echo ""
echo "=== E2E passed: email sent with PDF attached ==="
