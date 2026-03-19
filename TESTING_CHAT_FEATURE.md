# 🧪 Testing Guide: Chat & Comment Features

## ✅ Pre-Test Checklist
- [ ] Backend running on `localhost:8080`
- [ ] Frontend running on `localhost:5173`
- [ ] Logged in with manager or employee account
- [ ] Browser DevTools open (F12)

---

## 🧬 Test 1: Project Group Chat (Nhóm Chat)

### Steps:
1. Go to **Manager Dashboard**
2. **Select a project** from the left sidebar
3. Click the **"💬 Nhóm chat"** tab (rightmost tab)
4. **Expected Result**: 
   - Chat panel appears with input field at TOP
   - Input field should be **WIDE** (full width of panel)
   - Text should be **horizontal** (not vertical stacking)

### Debug if Issue:
Open **Browser DevTools (F12)** → **Elements tab**:
```
Look for input element with class "message-input"
Check computed styles:
  ✓ width: Should be ~100% or full width value
  ✓ box-sizing: Should be "border-box"
  ✓ display: Should NOT be width: 10px/1ch
```

### Send Message Test:
1. Click in the input field
2. Type: "Test message 🧪"
3. Press **Enter** or click **"Gửi"** button
4. **Expected**: Message appears above with:
   - Your name/avatar
   - Message text (horizontal)
   - Timestamp

### Troubleshooting:

| Issue | Solution |
|-------|----------|
| Input field is 1 character wide | Press F5 (reload), check DevTools |
| Text wraps vertically (nằm dọc) | Check white-space CSS in DevTools |
| "Cannot read property..." error | Check browser console (F12) for errors |
| Message doesn't post | Check Network tab (F12) for API calls to `/api/project-messages/send` |
| CORS error | Backend needs restart to accept new port |

---

## 🧬 Test 2: Task Comments (Bình Luận Công Việc)

### Steps:
1. Go to **Manager Dashboard** or **Employee Dashboard**
2. Find any task in the task grid
3. Click **"💬 Bình luận"** button on the task
4. **Modal opens** with task details + comments panel
5. **Expected Result**:
   - Comment form is at TOP
   - Input field is **WIDE** (full width)
   - Text is **horizontal** (not vertical)

### Debug if Issue:
Open **DevTools (F12)** → **Elements tab**:
```
Look for textarea with class "comment-input"
Check computed styles:
  ✓ width: Should be 100%
  ✓ box-sizing: Should be "border-box"
```

### Add Comment Test:
1. Click in the comment textarea
2. Type: "This task is progressing well ✅"
3. Click **"Bình luận"** button
4. **Expected**: Comment appears in list with:
   - Your name/avatar
   - Comment text
   - Edit/Delete buttons (if you're the author)

### Troubleshooting:

| Issue | Solution |
|-------|----------|
| Cannot click in textarea | Try clicking directly on the text area, not around it |
| Textarea too narrow | Reload (F5), check modal width in DevTools |
| Comment doesn't submit | Click in textarea first to focus, then submit |
| Cannot edit/delete own comment | User must be logged in as comment author |

---

## 🔍 Browser Console Debugging

### Enable Console Logs:
Press **F12** → **Console tab** → Look for blue logs:

```
🔵 ProjectChatPanel mounted/updated: {
  project: { id: "...", name: "..." },
  currentUser: { id: "...", email: "..." },
  memberCount: X
}
```

### Common Errors to Watch For:

**❌ "Cannot read property 'project' of undefined"**
- Fix: Component not receiving project prop
- Action: Check ManagerDashboard passes project={selectedProject}

**❌ "Cross-Origin Request Blocked"**
- Cause: CORS issue
- Fix: Backend must have `@CrossOrigin(origins = "http://localhost:5173")`

**❌ "401 Unauthorized"**
- Cause: JWT token expired or invalid
- Fix: Reload page (F5) and login again

**❌ Network error when sending message**
- Cause: Backend API endpoint failing
- Fix: Check backend console logs

---

## 📊 Network Tab Debug

Press **F12** → **Network tab** → Send a message:

### Expected API Calls:

**1. Send Message (POST)**
```
URL: http://localhost:8080/api/project-messages/send?projectId=XXX&userId=YYY
Status: 200 OK
Response: { id: "...", content: "...", sender: {...}, createdAt: "..." }
```

**2. Get Messages (GET)**
```
URL: http://localhost:8080/api/project-messages/project/XXX
Status: 200 OK
Response: [ { id, content, sender, createdAt }, ... ]
```

**3. Add Comment (POST)**
```
URL: http://localhost:8080/api/comments/add?taskId=XXX&userId=YYY
Status: 200 OK
Response: { id: "...", content: "...", author: {...}, createdAt: "..." }
```

---

## 🚀 Quick Test Checklist

| Feature | Test | Status |
|---------|------|--------|
| Input field width | Appears full-width | [ ] |
| Text horizontal | No vertical stacking | [ ] |
| Can click input | Cursor appears | [ ] |
| Can type | Text appears in field | [ ] |
| Can submit (Enter key) | Message/comment posts | [ ] |
| Multiple messages | All appear in list | [ ] |
| Message timestamps | Show creation time | [ ] |
| Edit own comment | Edit button works | [ ] |
| Delete own comment | Delete button works | [ ] |
| Cannot edit others' | No buttons on others' messages | [ ] |
| Different projects isolated | Project A chat ≠ Project B chat | [ ] |

---

## 📞 If All Tests Pass ✅
You're good to go! The following are working:
- ✓ Input field width fixed (box-sizing, flex layout)
- ✓ Message/comment form validation
- ✓ API endpoints for chat and comments
- ✓ MongoDB storage and retrieval
- ✓ CORS working between frontend and backend

---

## 🆘 If Tests Fail 🔴

### Step 1: Reload Everything
```
1. F5 (reload browser)
2. Check console (F12) for errors
3. If still broken → Continue Step 2
```

### Step 2: Backend Check
```
1. Verify Java server running: netstat -ano | findstr ":8080"
2. Check backend logs for exceptions
3. Restart backend if needed
```

### Step 3: Frontend Check
```
1. Check if npm run dev is still running (localhost:5173)
2. npm run build to verify compilation
3. Check package.json for axios, react versions
```

### Step 4: Database Check
```
1. Verify MongoDB is running
2. Check if collections exist (comments, project_messages)
3. Test backend API directly with Postman/Curl
```

---

## 📝 Notes
- **Performance**: Chat polls every 2 seconds (not real-time yet)
- **Styling**: Input fields use inline styles to bypass Bootstrap conflicts
- **Security**: Only project members can see/send messages
- **Edit/Delete**: Only message author can edit/delete own messages

---

**Last Updated**: After Latest Frontend Build  
**Status**: Ready for Testing  
**All Systems**: ✅ Green

