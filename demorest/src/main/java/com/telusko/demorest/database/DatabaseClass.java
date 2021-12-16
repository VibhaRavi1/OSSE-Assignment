package com.telusko.demorest.database;
import java.util.HashMap;
import java.util.Map;

import javax.xml.stream.events.Comment;

import com.telusko.demorest.model.Message;
import com.telusko.demorest.model.Profile;

public class DatabaseClass {
	private static Map<Long,Message>messages=new HashMap<>();
	private static Map<String,Profile>profiles=new HashMap<>();
//	private static Map<Long,Comment>commments=new HashMap<>();

	
	public static Map<Long,Message> getMessages()
	{
		return messages;
	}
	public static Map<String,Profile> getProfiles()
	{
		return profiles;
	}
}
