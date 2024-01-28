import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefereshTokens= async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken=await user.generateAccessToken()
       
        const refreshToken=await user.generateRefreashToken()
        // console.log("refershToken: ",refreshToken)

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
        
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating access and refresh token.")
    }
}

const registerUser= asyncHandler(async (req,res)=>{
        // get user details from frontend
        // validation - not empty
        // check if user already exists: username, email
        // check for images, check for avatar
        // upload them to cloudinary, avatar
        // create user object - create entry in db
        // remove password and refresh token field from response
        // check for user creation
        // return res
        
        // Task 1
        const {fullName, email, username, password}=req.body
        console.log("req.body: ", req.body)

        // Task 2
        if (
            [fullName, email, username, password].some((field)=> field?.trim() === "")
        ) {
            throw new ApiError(400, "User with email or username already exist")
        }

        // Task 3
        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        })
        if (existedUser) {
            throw new ApiError(409, "User with email or username already exists")
        }

        console.log("req.files",req.files)

        // Task 4
        const avatarLocalPath=req.files?.avatar[0]?.path;
        const coverImageLocalPath=req.files?.coverImage[0]?.path;


        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is required.")
        }

        // Task 5
        const avatar= await uploadOnCloudinary(avatarLocalPath)
        const coverImage=await uploadOnCloudinary(coverImageLocalPath)

        if(!avatar){
            throw new ApiError(400, "Avatar is required")
        }

        // Task 6
        const user= await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email, 
            password,
            username: username.toLowerCase()
        })

        console.log("user: ", user)
        // Task 7
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )
        
        console.log("createdUser: ",createdUser)
        // Task 8
        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user")
        }
    
        // Task 9
        return res.status(201).json(
            new ApiResponse(200, createdUser, "User registered Successfully")
        )


})

const loginUser= asyncHandler( async(req,res)=>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {username, email, password}=req.body

    if (!username && !email) {
        throw new ApiError(400, "Username and email is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if (!user) {
        throw new ApiError(404, "user does not exist")
    }

    const validPassword = await user.isPasswordCorrect(password)

    if(!validPassword){
        throw new ApiError(401, "Invalid login credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)
    // This point is important becoz the value of the token is send and still we are us
    // using await function.
    // const resolvedAccessToken = await accessToken;
    // console.log("accessToken: ",resolvedAccessToken)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options= {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged in successfully"
            )
    )
})

const logoutUser=asyncHandler(async(req,res)=>{
    // Assuming req.user._id contains the user's ID
    // Removing the refreshToken field from the document
    // Return the modified document

    await User.findByIdAndUpdate(
        req.user._id,
        {
            // this method was tought on tut video
            // $set:{
            //     refreshToken: underfined
            // }
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    // get refreshtoken from the req
    // check the for token
    // decode the refresh token
    // find the user model
    // verify the incoming refresh token with the token present in user model
    // generate access and refresh token(assign the newly generated refresh 
    // token to user model->refresh token)
    // return res with new access token and refresh token.
    
    const incomingToken= req.cookies?.refreshAccessToken || req.body

    if (!incomingToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken=jwt.verify(
            incomingToken,
            REFRESH_TOKEN_SECRET
            )
        
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }
        if (incomingToken !== user.refreshToken) {
            throw new ApiError(401,"refresh token is expired or used")
        }
    
        const {accessToken, newRefreshToken}= await generateAccessAndRefereshTokens(user._id)
    
        const options={
            httpOnly: true,
            seccure: true
        }
    
        return res
        .status(400)
        .cookie("accessToken", accessToken)
        .cookie("refreshToken", newRefreshToken)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken, },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    // req->body= oldPassword and newPassword
    // find the user instance of the model
    // check that oldPassword and password in the model is same.
    // update the password in the user model.

    const {oldPassword, newPassword} = req.body
    if (!oldPassword && !newPassword) {
        throw new ApiError(400, "oldPassword and newPassword is required")
    }

    const user= await User.findById(req.user?._id)

    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old Password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave: true})

    return res
    .status(200)
    .json( new ApiResponse(200, {}, "Password changed successfully") )

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "currect user fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    // get data from req.body
    // check that provide data should not be empty
    // find the user model instance
    // update the provide value in the model
    // save the changes

    const { fullName, email } = req.body
    
    if (!fullName && !email) {
        throw new ApiError(400, "fullName and email is required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },{
            new: true
        }

    )
    
    // If you want to explicitly run Mongoose validation on update or need 
    // more control over the update process
        // const user = User.findById(req.user?._id)
        // user.fullName=fullName
        // user.email=email
        // user.save({validateBeforeSave: true})

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    // get image from req.file.path
    // upload the image to cloudinary
    // get the user model instance
    // update the avatar url in user model

    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    // const user = await User.findById(req.user?._id).select('avatar');
    // if (user && user.avatar) {
    //     // Assuming the avatar is stored as a URL, extract the public ID or identifier
    //     const publicId = user.avatar.url// Extract public ID from user.avatar (depends on your storage solution)
        
    //     // Delete the old image from the storage (e.g., Cloudinary, AWS S3)
    //     await deleteFromCloudinary(publicId);
    // }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {user},
            "Avatar image updated successfully"
        )
    )

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover file is missing")
    }

    // const user = await User.findById(req.user?._id).select('avatar');
    // if (user && user.avatar) {
    //     // Assuming the avatar is stored as a URL, extract the public ID or identifier
    //     const publicId = user.avatar.url// Extract public ID from user.avatar (depends on your storage solution)
        
    //     // Delete the old image from the storage (e.g., Cloudinary, AWS S3)
    //     await deleteFromCloudinary(publicId);
    // }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {user},
            "Cover image updated successfully"
        )
    )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(400,"channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory 
}