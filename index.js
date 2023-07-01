const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const User = require('./models/User')
const Post = require('./models/Post')
const bcrypt = require('bcryptjs')
const session= require('express-session')
const MongoStore = require('connect-mongo');
const multer = require('multer')
const uploadMiddleware = multer({dest:'uploads/'})
const fs = require('fs')
const env = require('dotenv')

const app=express();

env.config();

app.use(session({secret:"abcde12345",resave: true,saveUninitialized: false, store: MongoStore.create({
    mongoUrl:process.env.DB_URL,
    collectionName:'sessions',
    ttl:1*24*60*60,
    autoRemove:'native',
    })}))

app.use(cors({credentials:true,origin:process.env.FRONTEND_URL}))
app.use(express.json())
app.use('/uploads',express.static(__dirname+'/uploads'))


app.listen(process.env.PORT || 4000,()=>{
    console.log("Server is running...");
})

const url = process.env.DB_URL
mongoose.connect(url).then(()=>{
    console.log("Database connected...");
})


app.post('/register',async(req,res)=>{
 try {
    const {username,password} = req.body;
    const user = new User({
        username,password: await bcrypt.hashSync(password,10)
    })

    const data = await user.save();

    if(data){
        res.json({
            success:true,
            message:"Registered successfully",
            data:data
        })
    }else{
        res.json({
            success:false,
            message:"Some error occured"
        })
    }

 } catch (error) {
    
    if(error.code === 11000){
        return res.status(400).json({
            success:false,
            message:"Username already in use. Please choose some other username"
        })
    }

    res.status(400).json({
        success:false,
        message:error.message
    })
 }
})

app.post('/login',async(req,res)=>{
    try {
       const {username,password} = req.body;
        
       const user = await User.findOne({username})
        
       if(user){
        const pass_match = await bcrypt.compareSync(password,user.password)
        if(pass_match){
            req.session.user_id = user._id
            console.log(req.session.user_id +"LOGIN");
            res.json({
                success:true,
                message:"Login successfully",
                data:user
            })
        }else{
            res.json({
                success:false,
                message:"Invalid Password"
            })
        }     
       }else{
           res.json({
               success:false,
               message:"User not found"
           })
       }
   
    } catch (error) {
       res.status(400).json({
           success:false,
           message:error.message
       })
    }
   })

app.post('/logout',(req,res)=>{
    try {
        req.session.destroy();
        res.json({
            success:true,
            message:"Logout successfully"
        })
    } catch (error) {
        res.status(400).json({
            success:false,
            message:error.message
        })
    }
})

app.post('/post',uploadMiddleware.single('file'),async (req,res)=>{
    try {
        const {originalname, path} = req.file;
        const parts = originalname.split('.')
        const ext = parts[parts.length-1]
        const newPath = path+'.'+ext
        fs.renameSync(path, newPath) 

        const {title, summary, content} = req.body;
                    console.log("POST")
                    console.log(req.session[1]+"POST");

        const post = new Post({
            title,summary,content,cover:newPath,author:req.session.user_id
        })
        console.log(req.session.user_id);
        const data = await post.save();
        if(data){
        res.json({
            success:true,
            message:"Post created successfully",
            data:data
        })}else{
            res.json({
                success:false,
                message:"Post couldn't be created"
            })
        }

    } catch (error) {
        res.status(400).json({
            success:false,
            message:error.message
        })
    }
})

app.get('/post', async(req,res)=>{
    try {
        const posts = await Post.find({}).populate('author','username').sort({createdAt:-1})
        res.json({
            success:true,
            data:posts
        })    
    } catch (error) {
        res.status(400).json({
            success:false,
            message:error.message
        })
    }
})

app.get('/post/:id', async(req,res)=>{
    try {
        const {id} = req.params
        const data = await Post.findById(id).populate('author','username')
        res.json({
            success:true,
            data:data
        })
    } catch (error) {
        res.status(400).json({
            success:false,
            message:error.message
        }) 
    }
})

app.put('/post',uploadMiddleware.single('file'),async(req,res)=>{
    try {

        let newPath = null;
        if (req.file) {
          const {originalname,path} = req.file;
          const parts = originalname.split('.');
          const ext = parts[parts.length - 1];
          newPath = path+'.'+ext;
          fs.renameSync(path, newPath);
        }

        const {id,title,summary,content} = req.body;
        const postDoc = await Post.findById(id);
        const post = await Post.findByIdAndUpdate(id,{
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
          });

          const data = post.save();

          if(data){
            res.json({
                success:true,
                message:"Post updated successfully"
            })
          }else{
            res.json({
                success:false,
                message:"Post didn't update"
            })
          }
      
    } catch (error) {
        res.status(400).json({
            success:false,
            message:error.message
        }) 
    }
})

app.get('/delete/:id', async(req,res)=>{
    try {
        const {id} = req.params;
        const post = await Post.findByIdAndDelete(id);
        if(post){
            res.json({
                success:true,
                message:"Post deleted successfully"
            })
        }else{
            res.json({
                success:false,
                message:"Post couldn't be deleted"
            }) 
        }
    } catch (error) {
        res.status(400).json({
            success:false,
            message:error.message
        }) 
    }
})

